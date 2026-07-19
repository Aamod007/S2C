import { NonRetriableError } from "inngest";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { inngest } from "./client";
import {
  ENTITLED_STATUSES,
  GRANT_EVENT_TYPES,
  extractCustomerEmail,
  extractSubscription,
  isPolarWebhookEvent,
  toMillis,
} from "@/types/polar";

/**
 * Credits granted per billing period on the standard plan (spec §8.2 grants
 * credits on subscription create/renew; the amount itself is not specified
 * in the spec, so it lives here as a single documented constant).
 */
export const STANDARD_PLAN_CREDITS = 100;

/** Small stable hash (djb2) for building compact idempotency keys. */
function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Polar webhook → Convex sync (spec §8.2).
 *
 * Receives the signature-validated Polar event forwarded by
 * /api/billing/webhook, upserts the subscription, grants period credits
 * idempotently, emits a synced event, then sleeps until the period end to
 * re-check entitlement (Inngest's "cron without a scheduler" pattern).
 */
export const handlePolarEvent = inngest.createFunction(
  {
    id: "handle-polar-event",
    triggers: [{ event: "billing/polar.webhook.received" }],
  },
  async ({ event, step }) => {
    // 1. Narrow/validate the payload shape.
    const payload = (event.data as { event?: unknown })?.event;
    if (!isPolarWebhookEvent(payload)) {
      throw new NonRetriableError("Invalid Polar webhook payload shape");
    }

    const subscription = extractSubscription(payload);
    if (!subscription) {
      // Order/benefit/customer events — nothing for us to sync (yet).
      return { skipped: true, type: payload.type };
    }

    // 2. Resolve the internal userId: prefer subscription.metadata.userId
    //    (set on the checkout by /api/billing/checkout), fall back to a
    //    normalized customer-email lookup.
    const metadataUserId =
      typeof subscription.metadata?.userId === "string"
        ? subscription.metadata.userId
        : null;

    const userId = (metadataUserId ??
      (await step.run("resolve-user-by-email", async () => {
        const email = extractCustomerEmail(subscription);
        if (!email) return null;
        return await fetchQuery(api.subscriptions.getUserIdByEmail, { email });
      }))) as Id<"users"> | null;

    if (!userId) {
      // No metadata and no matching user by email — retrying won't help.
      throw new NonRetriableError(
        `Could not resolve a user for Polar subscription ${subscription.id}`
      );
    }

    const periodEndMs = toMillis(subscription.currentPeriodEnd);

    // 3. Upsert the subscription row (credit_balance preserved server-side).
    await step.run("upsert-subscription", async () => {
      return await fetchMutation(api.subscriptions.upsertFromWebhook, {
        polarSubscriptionId: subscription.id,
        polarCustomerId: subscription.customerId,
        userId,
        priceId: subscription.prices?.[0]?.id,
        planCode: subscription.productId,
        status: subscription.status,
        currentPeriodEnd: periodEndMs,
        cancelAt: subscription.cancelAtPeriodEnd
          ? periodEndMs
          : toMillis(subscription.canceledAt) ?? undefined,
        trialEndsAt: toMillis(subscription.trialEnd),
      });
    });

    // 4. Grant period credits if entitled and this is a create/renew-style
    //    event. The idempotency key is derived from subscriptionId + period
    //    end only (NOT the event id): Polar emits several events per period
    //    (created → active → updated) and keying on the event id would grant
    //    once per event instead of once per billing period. The ledger check
    //    in grantCredits makes retries safe.
    const entitled = (ENTITLED_STATUSES as readonly string[]).includes(
      subscription.status
    );
    const isGrantEvent = (GRANT_EVENT_TYPES as readonly string[]).includes(
      payload.type
    );

    if (entitled && isGrantEvent && periodEndMs !== undefined) {
      const idempotencyKey = `grant_${djb2(
        `${subscription.id}:${periodEndMs}`
      )}`;
      await step.run("grant-credits", async () => {
        return await fetchMutation(api.subscriptions.grantCredits, {
          userId,
          subscriptionId: subscription.id,
          amount: STANDARD_PLAN_CREDITS,
          idempotencyKey,
        });
      });
    }

    // 5. Let the rest of the system know the subscription state is synced.
    await step.sendEvent("emit-synced", {
      name: "billing/subscriptions.synced",
      data: {
        userId,
        polarSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: periodEndMs ?? null,
      },
    });

    // 6. Sleep until the period end, then re-check entitlement and fire a
    //    pre-expiry event — cron-like behavior without a scheduler.
    if (periodEndMs !== undefined && periodEndMs > Date.now()) {
      await step.sleepUntil("wait-for-expiry", new Date(periodEndMs));

      const current = await step.run("recheck-entitlement", async () => {
        return await fetchQuery(api.subscriptions.getByPolarId, {
          polarSubscriptionId: subscription.id,
        });
      });

      await step.sendEvent("emit-pre-expiry", {
        name: "billing/subscription.pre-expiry",
        data: {
          userId,
          polarSubscriptionId: subscription.id,
          status: current?.status ?? "unknown",
          stillEntitled:
            current !== null &&
            (ENTITLED_STATUSES as readonly string[]).includes(current.status),
          // Renewal webhooks will have moved this forward if payment went
          // through; unchanged means the subscription is about to lapse.
          currentPeriodEnd: current?.current_period_end ?? null,
        },
      });
    }

    return { synced: true, subscriptionId: subscription.id };
  }
);

/**
 * Background autosave (spec §9). The API route authenticates the user,
 * verifies project ownership, then enqueues this job — so a closed browser
 * tab can't lose a save, and Convex failures retry automatically (Inngest's
 * default retry policy).
 */
export const autosaveProjectWorkflow = inngest.createFunction(
  {
    id: "autosave-project-workflow",
    // One save per project at a time — prevents concurrent jobs racing.
    concurrency: [{ key: "event.data.projectId", limit: 1 }],
    triggers: [{ event: "project/autosave.requested" }],
  },
  async ({ event, step }) => {
    const { userId, projectId, sketchesData, viewportData, savedAt } =
      event.data as {
        userId: string;
        projectId: string;
        sketchesData: unknown;
        viewportData?: unknown;
        savedAt?: number;
      };

    if (typeof userId !== "string" || typeof projectId !== "string") {
      throw new NonRetriableError("autosave event missing userId/projectId");
    }

    await step.run("update-sketches", async () => {
      return await fetchMutation(api.projects.updateSketchesFromWorkflow, {
        userId: userId as Id<"users">,
        projectId: projectId as Id<"projects">,
        sketches_data: sketchesData,
        viewport_data: viewportData,
        // Staleness guard: the mutation skips the patch if a newer snapshot
        // (higher saved_at) already landed — retried/reordered jobs can't
        // revert newer data.
        saved_at: savedAt,
      });
    });

    return { saved: true, projectId };
  }
);

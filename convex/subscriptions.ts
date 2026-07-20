import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "./auth";
import { requireInternalSecret } from "./internal_secret";
import { v } from "convex/values";

export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();
  },
});

export const isEntitled = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();

    if (!subscription) return false;

    return (
      subscription.status === "active" ||
      subscription.status === "trialing"
    );
  },
});

export const getCreditBalance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();

    return subscription?.credit_balance ?? 0;
  },
});

// ── Webhook / background-job entry points ────────────────────
//
// The functions below are called from server-side contexts with NO user
// identity (Inngest functions, Polar webhooks), so they take explicit args
// instead of resolving the user via ctx.auth. Because public Convex
// functions are callable by anyone who knows the deployment URL, every one
// of them is gated by `requireInternalSecret` — the caller must present the
// INTERNAL_FUNCTION_SECRET shared between the Next.js server env and the
// Convex deployment env. The gate fails closed if the secret is unset.

/**
 * Look up a users-table id by email. Email is normalized (trim + lowercase)
 * before comparison. Used by the Polar webhook flow when the subscription
 * has no `metadata.userId`.
 */
export const getUserIdByEmail = query({
  args: { email: v.string(), internalSecret: v.string() },
  handler: async (ctx, args) => {
    requireInternalSecret(args.internalSecret);
    const normalized = args.email.trim().toLowerCase();
    if (!normalized) return null;

    // Fast path: exact match via the by_email index (covers users whose
    // stored email is already lowercase).
    const indexed = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (indexed) return indexed._id;

    // Fallback: stored emails may have mixed casing (they come straight from
    // the Clerk identity). Scan and compare normalized forms.
    const users = await ctx.db.query("users").collect();
    const match = users.find(
      (u) => u.email.trim().toLowerCase() === normalized
    );
    return match?._id ?? null;
  },
});

/**
 * Upsert a subscription row from a Polar webhook event (no user ctx).
 *
 * Idempotency / integrity safeguards per spec §8.2:
 * - Looks up existing rows by BOTH polar_subscription_id AND user_id to
 *   detect duplicates or mismatched records.
 * - PRESERVES the existing credit_balance on update — renewals must never
 *   reset a user's balance. New rows start at 0 (grants are separate).
 */
export const upsertFromWebhook = mutation({
  args: {
    internalSecret: v.string(),
    polarSubscriptionId: v.string(),
    polarCustomerId: v.optional(v.string()),
    userId: v.id("users"),
    priceId: v.optional(v.string()),
    planCode: v.optional(v.string()),
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
    cancelAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireInternalSecret(args.internalSecret);
    if (!args.polarSubscriptionId.trim()) {
      throw new Error("polarSubscriptionId is required");
    }
    if (!args.status.trim()) {
      throw new Error("status is required");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Unknown userId");

    const bySubId = await ctx.db
      .query("subscriptions")
      .withIndex("by_polar_subscription_id", (q) =>
        q.eq("polar_subscription_id", args.polarSubscriptionId)
      )
      .first();

    const byUser = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .first();

    // Mismatch: the Polar subscription id exists but is bound to a different
    // user. Never silently reassign a subscription between users.
    if (bySubId && bySubId.user_id !== args.userId) {
      throw new Error(
        `Subscription ${args.polarSubscriptionId} belongs to a different user; refusing to reassign`
      );
    }

    const updates = {
      polar_subscription_id: args.polarSubscriptionId,
      polar_customer_id: args.polarCustomerId,
      price_id: args.priceId,
      plan_code: args.planCode,
      status: args.status,
      current_period_end: args.currentPeriodEnd,
      cancel_at: args.cancelAt,
      trial_ends_at: args.trialEndsAt,
    };

    // Prefer the row matched by Polar subscription id; otherwise reuse the
    // user's existing row (e.g. they resubscribed under a new Polar sub id)
    // rather than creating a duplicate per user.
    const existing = bySubId ?? byUser;

    if (existing) {
      // credit_balance intentionally NOT included — preserved across upserts.
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      user_id: args.userId,
      ...updates,
      credit_balance: 0,
    });
  },
});

/**
 * Grant credits from a webhook/background context (no user ctx).
 * Idempotent: if a ledger row with the same idempotency_key exists, the
 * grant is skipped (safe under Inngest/webhook retries).
 */
export const grantCredits = mutation({
  args: {
    internalSecret: v.string(),
    userId: v.id("users"),
    subscriptionId: v.string(), // polar_subscription_id
    amount: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireInternalSecret(args.internalSecret);
    if (args.amount <= 0) throw new Error("Amount must be positive");
    if (!args.idempotencyKey.trim()) {
      throw new Error("idempotencyKey is required");
    }

    // Idempotency — skip if this grant was already applied. Scoped to the
    // user and to grant-type rows so a key collision with another user's
    // ledger (or a consumption row) can never suppress a legitimate grant.
    const existing = await ctx.db
      .query("credits_ledger")
      .withIndex("by_user_and_idempotency_key", (q) =>
        q.eq("user_id", args.userId).eq("idempotency_key", args.idempotencyKey)
      )
      .filter((q) => q.eq(q.field("type"), "grant"))
      .first();
    if (existing) return { granted: false, reason: "duplicate" };

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_polar_subscription_id", (q) =>
        q.eq("polar_subscription_id", args.subscriptionId)
      )
      .first();

    if (!subscription) throw new Error("Subscription not found");
    if (subscription.user_id !== args.userId) {
      throw new Error("Subscription does not belong to this user");
    }

    await ctx.db.patch(subscription._id, {
      credit_balance: subscription.credit_balance + args.amount,
      last_grant_cursor: args.idempotencyKey,
    });

    await ctx.db.insert("credits_ledger", {
      user_id: args.userId,
      subscription_id: args.subscriptionId,
      amount: args.amount,
      type: "grant",
      reason: "subscription_period_grant",
      idempotency_key: args.idempotencyKey,
      created_at: Date.now(),
    });

    return { granted: true };
  },
});

/**
 * Read a subscription by its Polar id (no user ctx) — used by the Inngest
 * pre-expiry recheck step. Secret-gated like the other webhook entry points.
 */
export const getByPolarId = query({
  args: { polarSubscriptionId: v.string(), internalSecret: v.string() },
  handler: async (ctx, args) => {
    requireInternalSecret(args.internalSecret);
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_polar_subscription_id", (q) =>
        q.eq("polar_subscription_id", args.polarSubscriptionId)
      )
      .first();
  },
});

export const consumeCredits = mutation({
  args: {
    amount: v.number(),
    reason: v.string(),
    idempotency_key: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.amount <= 0) throw new Error("Amount must be positive");

    // Check idempotency — skip if already processed. Scoped to the caller
    // and to consumption-type rows: a global key lookup would let a key
    // collision with another user's ledger (or a grant row) silently skip
    // a legitimate charge.
    const existing = await ctx.db
      .query("credits_ledger")
      .withIndex("by_user_and_idempotency_key", (q) =>
        q.eq("user_id", userId).eq("idempotency_key", args.idempotency_key)
      )
      .filter((q) => q.eq(q.field("type"), "consumption"))
      .first();

    if (existing) return { consumed: false, reason: "duplicate" as const };

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .first();

    if (!subscription) throw new Error("No active subscription");
    if (
      subscription.status !== "active" &&
      subscription.status !== "trialing"
    ) {
      throw new Error("Subscription is not active");
    }
    if (subscription.credit_balance < args.amount) {
      throw new Error("Insufficient credits");
    }

    // Deduct credits
    await ctx.db.patch(subscription._id, {
      credit_balance: subscription.credit_balance - args.amount,
    });

    // Record in ledger
    await ctx.db.insert("credits_ledger", {
      user_id: userId,
      subscription_id: subscription.polar_subscription_id,
      amount: -args.amount,
      type: "consumption",
      reason: args.reason,
      idempotency_key: args.idempotency_key,
      created_at: Date.now(),
    });

    return { consumed: true as const };
  },
});

// Types + type guards for Polar webhook payloads as they arrive in Inngest.
//
// The webhook route validates the signature with `validateEvent` from
// '@polar-sh/sdk/webhooks' (SDK v0.48) which returns a discriminated union of
// typed payloads — but by the time the event has round-tripped through
// Inngest it has been JSON-serialized (Dates become ISO strings, class
// instances become plain objects). These types model that JSONified shape,
// and the guards re-narrow it defensively inside the Inngest function.

/** Subscription statuses that grant entitlement (spec §8.2). */
export const ENTITLED_STATUSES = ["active", "trialing"] as const;

/** Polar event types that represent a subscription being created/renewed. */
export const GRANT_EVENT_TYPES = [
  "subscription.created",
  "subscription.active",
  "subscription.updated",
] as const;

export interface PolarCustomer {
  id?: string;
  email?: string | null;
}

/** JSONified shape of the SDK's `Subscription` model (Dates → ISO strings). */
export interface PolarSubscription {
  id: string;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string | null;
  endsAt?: string | null;
  trialEnd?: string | null;
  customerId?: string;
  productId?: string;
  metadata?: Record<string, string | number | boolean> | null;
  customer?: PolarCustomer | null;
  prices?: Array<{ id?: string }> | null;
}

/** JSONified shape of a validated Polar webhook payload. */
export interface PolarWebhookEvent {
  type: string;
  timestamp?: string;
  data: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrow an unknown payload to a Polar webhook event envelope. */
export function isPolarWebhookEvent(value: unknown): value is PolarWebhookEvent {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    isRecord(value.data)
  );
}

/**
 * Extract a subscription object from a webhook event, or null if the event
 * doesn't carry one (e.g. order/benefit/customer events).
 */
export function extractSubscription(
  event: PolarWebhookEvent
): PolarSubscription | null {
  if (!event.type.startsWith("subscription.")) return null;

  const data = event.data;
  if (!isRecord(data) || typeof data.id !== "string") return null;
  if (typeof data.status !== "string") return null;

  return data as unknown as PolarSubscription;
}

/** Extract the customer email from a subscription, normalized, or null. */
export function extractCustomerEmail(
  subscription: PolarSubscription
): string | null {
  const email = subscription.customer?.email;
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/** Millisecond timestamp from an ISO date string, or undefined. */
export function toMillis(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
}

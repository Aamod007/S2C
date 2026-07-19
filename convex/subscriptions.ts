import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "./auth";
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

    // Check idempotency — skip if already processed
    const existing = await ctx.db
      .query("credits_ledger")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotency_key", args.idempotency_key)
      )
      .first();

    if (existing) return; // Already processed

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
  },
});

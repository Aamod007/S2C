import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  project_counters: defineTable({
    user_id: v.id("users"),
    next_project_number: v.number(),
  }).index("by_user", ["user_id"]),

  projects: defineTable({
    user_id: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    style_guide: v.optional(v.any()),
    sketches_data: v.optional(v.any()),
    viewport_data: v.optional(v.any()),
    // Monotonic timestamp of the last-applied autosave snapshot (staleness guard)
    sketches_saved_at: v.optional(v.number()),
    mood_board_images: v.optional(v.array(v.string())),
    inspiration_images: v.optional(v.array(v.string())),
    last_modified: v.number(),
    created_at: v.number(),
    is_public: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    project_number: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_user_and_number", ["user_id", "project_number"]),

  credits_ledger: defineTable({
    user_id: v.id("users"),
    subscription_id: v.optional(v.string()),
    amount: v.number(),
    type: v.string(),
    reason: v.string(),
    idempotency_key: v.optional(v.string()),
    metadata: v.optional(v.any()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_idempotency_key", ["idempotency_key"])
    .index("by_user_and_idempotency_key", ["user_id", "idempotency_key"]),

  subscriptions: defineTable({
    user_id: v.id("users"),
    polar_subscription_id: v.string(),
    polar_customer_id: v.optional(v.string()),
    price_id: v.optional(v.string()),
    plan_code: v.optional(v.string()),
    status: v.string(),
    current_period_end: v.optional(v.number()),
    cancel_at: v.optional(v.number()),
    trial_ends_at: v.optional(v.number()),
    credit_balance: v.number(),
    last_grant_cursor: v.optional(v.string()),
  })
    .index("by_user", ["user_id"])
    .index("by_polar_subscription_id", ["polar_subscription_id"]),
});

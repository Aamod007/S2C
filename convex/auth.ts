import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export async function getAuthUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  
  if (identity) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    return user?._id ?? null;
  }

  // BYPASS LOGIN FOR NOW: If not authenticated, just return the first user in the database
  const firstUser = await ctx.db.query("users").first();
  if (firstUser) {
    return firstUser._id;
  }

  // If no users exist, create a dummy one
  if ('insert' in ctx.db) {
      const dummyId = await (ctx.db as any).insert("users", {
        clerkId: "dummy_clerk_id",
        name: "Test User",
        email: "test@example.com",
      });
      return dummyId;
  }
  
  return null;
}

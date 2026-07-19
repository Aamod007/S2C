import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Resolves the authenticated Clerk identity to our users-table id.
 * Returns null if unauthenticated or if the Clerk user has no matching
 * users row yet (e.g. before the user sync mutation has run).
 */
export async function getAuthUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return user?._id ?? null;
}

import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "./auth";

export const storeUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (user !== null) {
      // If we've seen this identity before but the name/email/image changed, patch it.
      if (
        user.name !== identity.name ||
        user.email !== identity.email ||
        user.image !== identity.pictureUrl
      ) {
        await ctx.db.patch(user._id, {
          name: identity.name,
          email: identity.email,
          image: identity.pictureUrl,
        });
      }
      return user._id;
    }

    // If it's a new identity, create a new user.
    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: identity.name,
      email: identity.email!,
      image: identity.pictureUrl,
    });
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

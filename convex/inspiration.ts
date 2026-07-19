import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

const MAX_INSPIRATION_IMAGES = 5;

export const addImage = mutation({
  args: {
    projectId: v.id("projects"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== userId) {
      throw new Error("Project not found or unauthorized");
    }

    const currentImages = project.inspiration_images ?? [];
    if (currentImages.length >= MAX_INSPIRATION_IMAGES) {
      throw new Error(
        `Maximum of ${MAX_INSPIRATION_IMAGES} inspiration images allowed`
      );
    }

    await ctx.db.patch(args.projectId, {
      inspiration_images: [...currentImages, args.storageId],
      last_modified: Date.now(),
    });
  },
});

export const removeImage = mutation({
  args: {
    projectId: v.id("projects"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== userId) {
      throw new Error("Project not found or unauthorized");
    }

    try {
      await ctx.storage.delete(args.storageId as any);
    } catch {
      // Storage ID may already be deleted
    }

    const currentImages = project.inspiration_images ?? [];
    await ctx.db.patch(args.projectId, {
      inspiration_images: currentImages.filter((id) => id !== args.storageId),
      last_modified: Date.now(),
    });
  },
});

export const getImageUrls = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== userId) return [];

    const storageIds = project.inspiration_images ?? [];
    const urls = await Promise.all(
      storageIds.map(async (id) => {
        const url = await ctx.storage.getUrl(id as any);
        return url ? { storageId: id, url } : null;
      })
    );

    return urls.filter(Boolean);
  },
});

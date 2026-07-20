import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "./auth";
import { v } from "convex/values";

const MAX_MOODBOARD_IMAGES = 6;

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

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

    const currentImages = project.mood_board_images ?? [];
    if (currentImages.length >= MAX_MOODBOARD_IMAGES) {
      throw new Error(
        `Maximum of ${MAX_MOODBOARD_IMAGES} mood board images allowed`
      );
    }

    await ctx.db.patch(args.projectId, {
      mood_board_images: [...currentImages, args.storageId],
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

    const currentImages = project.mood_board_images ?? [];
    // Storage ids are deployment-global — only delete files this project's
    // image array actually references, otherwise any project owner could
    // delete arbitrary files (including other users') by id.
    if (!currentImages.includes(args.storageId)) {
      throw new Error("Image does not belong to this project");
    }

    // Delete from storage
    try {
      await ctx.storage.delete(args.storageId as any);
    } catch {
      // Storage ID may already be deleted — continue
    }

    await ctx.db.patch(args.projectId, {
      mood_board_images: currentImages.filter((id) => id !== args.storageId),
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

    const storageIds = project.mood_board_images ?? [];
    const urls = await Promise.all(
      storageIds.map(async (id) => {
        const url = await ctx.storage.getUrl(id as any);
        return url ? { storageId: id, url } : null;
      })
    );

    return urls.filter(Boolean);
  },
});

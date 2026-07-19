import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "./auth";
import { v } from "convex/values";

// ── Queries ──────────────────────────────────────────────────

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .order("desc")
      .collect();

    return projects;
  },
});

export const getById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== userId) return null;

    return project;
  },
});

// ── Mutations ────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get or create project counter for this user
    const counter = await ctx.db
      .query("project_counters")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .unique();

    let projectNumber: number;
    if (counter) {
      projectNumber = counter.next_project_number;
      await ctx.db.patch(counter._id, {
        next_project_number: projectNumber + 1,
      });
    } else {
      projectNumber = 1;
      await ctx.db.insert("project_counters", {
        user_id: userId,
        next_project_number: 2,
      });
    }

    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      user_id: userId,
      name: args.name,
      description: args.description,
      last_modified: now,
      created_at: now,
      project_number: projectNumber,
    });

    return projectId;
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    is_public: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    style_guide: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== userId) {
      throw new Error("Project not found or unauthorized");
    }

    const { projectId, ...updates } = args;
    await ctx.db.patch(projectId, {
      ...updates,
      last_modified: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== userId) {
      throw new Error("Project not found or unauthorized");
    }

    await ctx.db.delete(args.projectId);
  },
});

export const updateSketches = mutation({
  args: {
    projectId: v.id("projects"),
    sketches_data: v.any(),
    viewport_data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== userId) {
      throw new Error("Project not found or unauthorized");
    }

    await ctx.db.patch(args.projectId, {
      sketches_data: args.sketches_data,
      viewport_data: args.viewport_data,
      last_modified: Date.now(),
    });
  },
});

/**
 * Webhook-safe variant of `updateSketches` for the Inngest autosave workflow,
 * which runs with NO user identity (ctx.auth is empty). Takes the userId
 * explicitly — the caller (our autosave API route) has already authenticated
 * the user via Clerk and verified ownership before enqueueing the job; this
 * mutation re-verifies `project.user_id === userId` as defense in depth.
 *
 * ⚠️ SECURITY NOTE: as a public mutation this is callable by anyone with the
 * deployment URL who can guess a (userId, projectId) pair. Should become an
 * `internalMutation` invoked via an action/HTTP action with a shared secret
 * before production (same caveat as the webhook functions in
 * convex/subscriptions.ts).
 */
export const updateSketchesFromWorkflow = mutation({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
    sketches_data: v.any(),
    viewport_data: v.optional(v.any()),
    saved_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.user_id !== args.userId) {
      throw new Error("Project not found or unauthorized");
    }

    // Staleness guard: autosave jobs can be retried/reordered by Inngest.
    // If a newer snapshot already landed, skip — never revert newer data.
    if (
      args.saved_at !== undefined &&
      project.sketches_saved_at !== undefined &&
      args.saved_at <= project.sketches_saved_at
    ) {
      return { skipped: "stale" };
    }

    await ctx.db.patch(args.projectId, {
      sketches_data: args.sketches_data,
      viewport_data: args.viewport_data,
      sketches_saved_at: args.saved_at,
      last_modified: Date.now(),
    });
  },
});

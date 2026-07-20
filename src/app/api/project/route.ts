import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { inngest } from "@/inngest/client";

// PATCH /api/project — debounced autosave endpoint (spec §9). Authenticates
// via Clerk, verifies project OWNERSHIP (flagged as missing in the source
// project — required here), then enqueues the Inngest autosave workflow and
// returns immediately. The actual Convex write happens in the background so
// a closed tab can't lose the save.
export async function PATCH(request: NextRequest) {
  try {
    const { userId: clerkUserId, getToken } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
      projectId?: string;
      sketchesData?: unknown;
      viewportData?: unknown;
      savedAt?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { projectId, sketchesData, viewportData, savedAt } = body;
    if (typeof projectId !== "string" || !projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }
    if (sketchesData === undefined) {
      return NextResponse.json(
        { error: "sketchesData is required" },
        { status: 400 }
      );
    }

    // Ownership check — projects.getById resolves the caller through
    // ctx.auth (via the Convex-templated Clerk JWT) and returns null unless
    // project.user_id matches the caller. Do NOT enqueue without this.
    const token = (await getToken({ template: "convex" })) ?? undefined;
    if (!token) {
      console.error("Autosave: could not mint Convex token for ownership check");
      return NextResponse.json(
        { error: "Could not verify project ownership" },
        { status: 500 }
      );
    }

    const project = await fetchQuery(
      api.projects.getById,
      { projectId: projectId as Id<"projects"> },
      { token }
    );
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or unauthorized" },
        { status: 404 }
      );
    }

    // project.user_id is the caller's Convex users-table id (getById only
    // returns projects owned by the caller) — exactly what the workflow's
    // webhook-safe mutation needs.
    // Snapshot timestamp for the staleness guard. Prefer the CLIENT's
    // stamp (taken when the snapshot was sent) — stamping here would
    // order saves by when their handlers ran, so an older request whose
    // ownership check stalled could out-stamp a newer one that already
    // landed. Fall back to server time for older clients.
    const effectiveSavedAt =
      typeof savedAt === "number" && Number.isFinite(savedAt) && savedAt > 0
        ? savedAt
        : Date.now();

    try {
      await inngest.send({
        name: "project/autosave.requested",
        data: {
          userId: project.user_id,
          projectId,
          sketchesData,
          viewportData,
          savedAt: effectiveSavedAt,
        },
      });
      return NextResponse.json({ status: "queued" }, { status: 200 });
    } catch (inngestError) {
      // Inngest unreachable (no `npx inngest-cli dev` locally, or event-key
      // outage in prod). The save must not be lost — write Convex directly
      // with the caller's own token. We lose Inngest's tab-close durability
      // for this one save, but the request is already server-side here.
      console.warn(
        "Autosave: Inngest enqueue failed, saving directly:",
        inngestError
      );
      await fetchMutation(
        api.projects.updateSketches,
        {
          projectId: projectId as Id<"projects">,
          sketches_data: sketchesData,
          viewport_data: viewportData,
          saved_at: effectiveSavedAt,
        },
        { token }
      );
      return NextResponse.json({ status: "saved-direct" }, { status: 200 });
    }
  } catch (error) {
    console.error("Autosave enqueue failed:", error);
    return NextResponse.json(
      { error: "Failed to queue autosave" },
      { status: 500 }
    );
  }
}

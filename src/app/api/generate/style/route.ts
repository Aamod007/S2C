import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { styleGuideSchema } from "@/types/style-guide";
import {
  styleGuideSystemPrompt,
  buildStyleGuideUserPrompt,
} from "@/prompts";
import {
  ApiError,
  errorResponse,
  requireProjectWithCredits,
  consumeCreditsAfterSuccess,
  buildIdempotencyKey,
} from "../_lib/context";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/generate/style — spec §7.1
 * Generates a style guide from the project's mood board images via
 * generateObject, saves it to projects.style_guide, and consumes 1 credit
 * after success.
 *
 * Body: { projectId: string, requestId?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new ApiError(400, "Invalid JSON body");
    });

    const ctx = await requireProjectWithCredits(body?.projectId);

    // Mood board images are the entire input — refuse without them.
    const moodboard = await fetchQuery(
      api.moodboard.getImageUrls,
      { projectId: ctx.projectId },
      { token: ctx.token }
    );
    const imageUrls = (moodboard ?? [])
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((e) => e.url);

    if (imageUrls.length === 0) {
      throw new ApiError(
        400,
        "Add at least one mood board image before generating a style guide"
      );
    }

    const { object: styleGuide } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: styleGuideSchema,
      system: styleGuideSystemPrompt,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildStyleGuideUserPrompt(imageUrls.length) },
            ...imageUrls.map((url) => ({
              type: "image" as const,
              image: new URL(url),
            })),
          ],
        },
      ],
    });

    // Persist to projects.style_guide (declared as v.optional(v.any()) in
    // convex/projects.ts update args).
    let saved = true;
    try {
      await fetchMutation(
        api.projects.update,
        { projectId: ctx.projectId, style_guide: styleGuide },
        { token: ctx.token }
      );
    } catch (error) {
      saved = false;
      console.error("[api/generate/style] failed to save style guide:", error);
    }

    // Charge only after the AI call succeeded (spec §8.3 / §14).
    await consumeCreditsAfterSuccess({
      token: ctx.token,
      idempotencyKey: buildIdempotencyKey("style", ctx.projectId, body?.requestId),
      reason: `Style guide generation for project ${ctx.projectId}`,
    });

    return Response.json({ styleGuide, saved });
  } catch (error) {
    return errorResponse(error);
  }
}

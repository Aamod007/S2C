import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, streamText } from "ai";
import { suggestedPagesSchema } from "@/types/style-guide";
import {
  workflowSystemPrompt,
  derivePagesSystemPrompt,
  buildWorkflowPageUserPrompt,
  buildDerivePagesUserPrompt,
} from "@/prompts";
import {
  ApiError,
  errorResponse,
  requireProjectWithCredits,
  getInspirationUrls,
  consumeCreditsAfterSuccess,
  buildIdempotencyKey,
  htmlStreamResponse,
} from "../_lib/context";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_HTML_CHARS = 400_000;

/**
 * POST /api/generate/workflow — spec §7.4 (+ recommended improvement)
 * One route, two modes:
 *
 * 1. Derive mode — body { projectId, mainPageHtml, derivePages: true }:
 *    returns JSON { pages: [{ name, description }] } with 3-4 suggested next
 *    pages derived dynamically from the main page's content (replacing the
 *    source project's hardcoded list). Free (no credit) — it's a cheap
 *    planning call; credits are charged per generated page.
 *
 * 2. Page mode — body { projectId, mainPageHtml, pageType, requestId? }:
 *    streams one new page's HTML (text/html), styled for consistency with
 *    mainPageHtml. Consumes 1 credit after the stream completes. The client
 *    calls this once per suggested page and manages placement/batching.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new ApiError(400, "Invalid JSON body");
    });

    const { mainPageHtml, pageType, derivePages } = body ?? {};

    if (typeof mainPageHtml !== "string" || mainPageHtml.trim().length === 0) {
      throw new ApiError(400, "Missing mainPageHtml");
    }
    if (mainPageHtml.length > MAX_HTML_CHARS) {
      throw new ApiError(400, "mainPageHtml too large");
    }

    // ── Mode 1: derive suggested pages ─────────────────────────
    if (derivePages === true) {
      // Auth + ownership still enforced; credit balance must be > 0 to plan.
      await requireProjectWithCredits(body?.projectId);

      const { object } = await generateObject({
        model: anthropic("claude-sonnet-4-6"),
        schema: suggestedPagesSchema,
        system: derivePagesSystemPrompt,
        prompt: buildDerivePagesUserPrompt(mainPageHtml),
      });

      return Response.json(object);
    }

    // ── Mode 2: stream one workflow page ───────────────────────
    if (typeof pageType !== "string" || pageType.trim().length === 0) {
      throw new ApiError(400, "Missing pageType (or set derivePages: true)");
    }
    if (pageType.length > 200) {
      throw new ApiError(400, "pageType too long");
    }

    const ctx = await requireProjectWithCredits(body?.projectId);
    const inspirationUrls = await getInspirationUrls(ctx.projectId, ctx.token);

    const idempotencyKey = buildIdempotencyKey(
      `workflow:${pageType.trim().toLowerCase().replace(/\s+/g, "-")}`,
      ctx.projectId,
      body?.requestId
    );

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: workflowSystemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildWorkflowPageUserPrompt({
                pageType: pageType.trim(),
                mainPageHtml,
                styleGuide: ctx.styleGuide,
                inspirationImageUrls: inspirationUrls,
              }),
            },
            ...inspirationUrls.map((url) => ({
              type: "image" as const,
              image: new URL(url),
            })),
          ],
        },
      ],
      onFinish: async () => {
        await consumeCreditsAfterSuccess({
          token: ctx.token,
          idempotencyKey,
          reason: `Workflow page "${pageType.trim()}" for project ${ctx.projectId}`,
        });
      },
      onError: ({ error }) => {
        console.error("[api/generate/workflow] stream error:", error);
      },
    });

    return htmlStreamResponse(result.textStream);
  } catch (error) {
    return errorResponse(error);
  }
}

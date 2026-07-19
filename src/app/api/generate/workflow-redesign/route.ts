import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { redesignSystemPrompt, buildWorkflowRedesignUserPrompt } from "@/prompts";
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
const MAX_MESSAGE_CHARS = 4_000;

/**
 * POST /api/generate/workflow-redesign
 * Chat redesign of a workflow-generated page: like /api/generate/redesign,
 * but the prompt also carries the main page's HTML so edits stay visually
 * consistent with the rest of the workflow. JSON body:
 *   { projectId, message, currentHtml, mainPageHtml, shapeId, requestId? }
 * Streams the full replacement HTML; consumes 1 credit on successful finish.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new ApiError(400, "Invalid JSON body");
    });

    const { message, currentHtml, mainPageHtml, shapeId } = body ?? {};

    if (typeof message !== "string" || message.trim().length === 0) {
      throw new ApiError(400, "Missing message");
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      throw new ApiError(400, "Message too long");
    }
    if (typeof currentHtml !== "string" || currentHtml.trim().length === 0) {
      throw new ApiError(400, "Missing currentHtml");
    }
    if (typeof mainPageHtml !== "string" || mainPageHtml.trim().length === 0) {
      throw new ApiError(400, "Missing mainPageHtml");
    }
    if (currentHtml.length > MAX_HTML_CHARS || mainPageHtml.length > MAX_HTML_CHARS) {
      throw new ApiError(400, "HTML payload too large");
    }
    if (typeof shapeId !== "string" || shapeId.length === 0) {
      throw new ApiError(400, "Missing shapeId");
    }

    const ctx = await requireProjectWithCredits(body?.projectId);
    const inspirationUrls = await getInspirationUrls(ctx.projectId, ctx.token);

    const idempotencyKey = buildIdempotencyKey(
      `workflow-redesign:${shapeId}`,
      ctx.projectId,
      body?.requestId
    );

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: redesignSystemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildWorkflowRedesignUserPrompt({
                message: message.trim(),
                currentHtml,
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
          reason: `Workflow redesign of shape ${shapeId} in project ${ctx.projectId}`,
        });
      },
      onError: ({ error }) => {
        console.error("[api/generate/workflow-redesign] stream error:", error);
      },
    });

    return htmlStreamResponse(result.textStream);
  } catch (error) {
    return errorResponse(error);
  }
}

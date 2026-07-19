import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import type { ImagePart, TextPart } from "ai";
import { redesignSystemPrompt, buildRedesignUserPrompt } from "@/prompts";
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
 * POST /api/generate/redesign — spec §7.3
 * Chat-driven redesign of a generated UI shape. JSON body:
 *   { projectId, message, currentHtml, snapshot?: base64, shapeId, requestId? }
 * Streams the full replacement HTML; consumes 1 credit on successful finish.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new ApiError(400, "Invalid JSON body");
    });

    const { message, currentHtml, snapshot, shapeId } = body ?? {};

    if (typeof message !== "string" || message.trim().length === 0) {
      throw new ApiError(400, "Missing message");
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      throw new ApiError(400, "Message too long");
    }
    if (typeof currentHtml !== "string" || currentHtml.trim().length === 0) {
      throw new ApiError(400, "Missing currentHtml");
    }
    if (currentHtml.length > MAX_HTML_CHARS) {
      throw new ApiError(400, "currentHtml too large");
    }
    if (typeof shapeId !== "string" || shapeId.length === 0) {
      throw new ApiError(400, "Missing shapeId");
    }

    const ctx = await requireProjectWithCredits(body?.projectId);
    const inspirationUrls = await getInspirationUrls(ctx.projectId, ctx.token);

    const hasSnapshot = typeof snapshot === "string" && snapshot.length > 0;

    const content: Array<TextPart | ImagePart> = [
      {
        type: "text",
        text: buildRedesignUserPrompt({
          message: message.trim(),
          currentHtml,
          styleGuide: ctx.styleGuide,
          inspirationImageUrls: inspirationUrls,
          hasSnapshot,
        }),
      },
    ];

    if (hasSnapshot) {
      // Accept both raw base64 and data-URL form from the client.
      const base64 = snapshot.startsWith("data:")
        ? snapshot.slice(snapshot.indexOf(",") + 1)
        : snapshot;
      content.push({ type: "image", image: base64, mediaType: "image/png" });
    }

    content.push(
      ...inspirationUrls.map(
        (url): ImagePart => ({ type: "image", image: new URL(url) })
      )
    );

    const idempotencyKey = buildIdempotencyKey(
      `redesign:${shapeId}`,
      ctx.projectId,
      body?.requestId
    );

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: redesignSystemPrompt,
      messages: [{ role: "user", content }],
      onFinish: async () => {
        await consumeCreditsAfterSuccess({
          token: ctx.token,
          idempotencyKey,
          reason: `Chat redesign of shape ${shapeId} in project ${ctx.projectId}`,
        });
      },
      onError: ({ error }) => {
        console.error("[api/generate/redesign] stream error:", error);
      },
    });

    return htmlStreamResponse(result.textStream);
  } catch (error) {
    return errorResponse(error);
  }
}

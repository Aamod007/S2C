import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import {
  designGenerationSystemPrompt,
  buildDesignUserPrompt,
} from "@/prompts";
import {
  ApiError,
  errorResponse,
  requireProjectWithCredits,
  getInspirationUrls,
  consumeCreditsAfterSuccess,
  buildIdempotencyKey,
  htmlStreamResponse,
} from "./_lib/context";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SKETCH_BYTES = 8 * 1024 * 1024; // 8 MB frame snapshot cap

/**
 * POST /api/generate — spec §7.2
 * Sketch → design generation. Accepts FormData:
 *   image: File (frame snapshot PNG/JPEG)
 *   frameNumber: string
 *   projectId: string
 *   requestId?: string (idempotency)
 * Streams the generated HTML back as text/html; consumes 1 credit after the
 * stream completes successfully (streamText onFinish).
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData().catch(() => {
      throw new ApiError(400, "Expected multipart/form-data body");
    });

    const image = formData.get("image");
    if (!(image instanceof File) || image.size === 0) {
      throw new ApiError(400, "Missing sketch image file");
    }
    if (image.size > MAX_SKETCH_BYTES) {
      throw new ApiError(400, "Sketch image too large (max 8MB)");
    }

    const frameNumberRaw = formData.get("frameNumber");
    const frameNumber =
      typeof frameNumberRaw === "string" && frameNumberRaw !== ""
        ? Number(frameNumberRaw)
        : undefined;

    const ctx = await requireProjectWithCredits(formData.get("projectId"));
    const inspirationUrls = await getInspirationUrls(ctx.projectId, ctx.token);

    const imageBytes = new Uint8Array(await image.arrayBuffer());

    const idempotencyKey = buildIdempotencyKey(
      "generate",
      ctx.projectId,
      formData.get("requestId")
    );

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: designGenerationSystemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildDesignUserPrompt({
                styleGuide: ctx.styleGuide,
                inspirationImageUrls: inspirationUrls,
                frameNumber: Number.isFinite(frameNumber) ? frameNumber : undefined,
              }),
            },
            // The sketch itself (raw bytes — the SDK base64-encodes for Anthropic).
            {
              type: "image",
              image: imageBytes,
              mediaType: image.type || "image/png",
            },
            // Inspiration images by URL.
            ...inspirationUrls.map((url) => ({
              type: "image" as const,
              image: new URL(url),
            })),
          ],
        },
      ],
      // Charge only once the full stream finished successfully (spec §14).
      onFinish: async () => {
        await consumeCreditsAfterSuccess({
          token: ctx.token,
          idempotencyKey,
          reason: `Sketch-to-design generation (frame ${frameNumber ?? "?"}) for project ${ctx.projectId}`,
        });
      },
      onError: ({ error }) => {
        console.error("[api/generate] stream error:", error);
      },
    });

    return htmlStreamResponse(result.textStream);
  } catch (error) {
    return errorResponse(error);
  }
}

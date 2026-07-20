"use client";

import { useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  addGeneratedUI,
  removeShape,
  shapesSelectors,
  updateShape,
} from "@/redux/slices/shapes";
import { FrameShape, GeneratedUIShape, Shape } from "@/types/shapes";
import { generateFrameSnapshot } from "@/lib/frame-snapshot";

/** Gap between a frame and its generated design / between workflow pages. */
const GENERATED_GAP = 50;
/** Min ms between updateShape dispatches while streaming (≈10/s, spec: no per-chunk React storms). */
const STREAM_FLUSH_MS = 100;
/** Slightly coarser flushing when several workflow pages stream concurrently. */
const WORKFLOW_FLUSH_MS = 150;

export class GenerationRequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "GenerationRequestError";
  }
}

/** Extracts the server's { error } message from a failed generate response. */
export async function toGenerationError(
  res: Response
): Promise<GenerationRequestError> {
  let message = `Generation failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body?.error === "string" && body.error) message = body.error;
  } catch {
    // non-JSON error body — keep the generic message
  }
  return new GenerationRequestError(res.status, message);
}

/**
 * Reads a streaming text/html Response, calling `onUpdate` with the
 * accumulated HTML at most once per `flushMs` (plus a final flush).
 * Returns the complete HTML string.
 */
export async function readHtmlStream(
  res: Response,
  onUpdate: (html: string) => void,
  flushMs: number = STREAM_FLUSH_MS
): Promise<string> {
  if (!res.body) throw new Error("Response has no stream body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let lastFlush = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    const now = performance.now();
    if (now - lastFlush >= flushMs) {
      lastFlush = now;
      onUpdate(html);
    }
  }
  html += decoder.decode();
  onUpdate(html);
  return html;
}

/** Toast for generation failures; special-cases 402 = out of credits (spec §7.2). */
export function toastGenerationError(error: unknown, fallback: string): void {
  if (error instanceof GenerationRequestError && error.status === 402) {
    toast.error("Out of credits — please upgrade your plan to keep generating.");
    return;
  }
  toast.error(error instanceof Error && error.message ? error.message : fallback);
}

/**
 * Frame → design generation (spec §7.2) and multi-page workflow generation
 * (spec §7.4). Streams HTML into generated-ui shapes on the canvas.
 */
export function useFrame(projectId: string) {
  const dispatch = useAppDispatch();
  const shapes = useAppSelector(shapesSelectors.selectAll);
  // Frame ids with an in-flight design or workflow generation.
  const [busyFrameIds, setBusyFrameIds] = useState<string[]>([]);

  const markBusy = useCallback((frameId: string, busy: boolean) => {
    setBusyFrameIds((ids) =>
      busy ? [...ids, frameId] : ids.filter((id) => id !== frameId)
    );
  }, []);

  /** 1-based frame number by canvas order (matches the export filename/prompt). */
  const frameNumberOf = useCallback(
    (frame: FrameShape) => {
      const frames = shapes.filter((s) => s.type === "frame");
      const index = frames.findIndex((s) => s.id === frame.id);
      return index === -1 ? frames.length + 1 : index + 1;
    },
    [shapes]
  );

  const generateDesign = useCallback(
    async (frame: FrameShape) => {
      const shapeId = uuidv4();
      const frameNumber = frameNumberOf(frame);
      let placeholderAdded = false;

      markBusy(frame.id, true);
      try {
        const blob = await generateFrameSnapshot(frame, shapes);

        const formData = new FormData();
        formData.append("image", blob, `frame-${frameNumber}.png`);
        formData.append("frameNumber", String(frameNumber));
        formData.append("projectId", projectId);
        formData.append("requestId", uuidv4());

        // Placeholder appears immediately, offset right of the source frame.
        dispatch(
          addGeneratedUI({
            id: shapeId,
            type: "generated-ui",
            x: frame.x + frame.width + GENERATED_GAP,
            y: frame.y,
            width: frame.width,
            height: frame.height,
            uiSpecData: "",
            sourceFrameId: frame.id,
            name: `Screen ${frameNumber}`,
            status: "streaming",
          } satisfies GeneratedUIShape as Shape)
        );
        placeholderAdded = true;

        const res = await fetch("/api/generate", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw await toGenerationError(res);

        const html = await readHtmlStream(res, (acc) =>
          dispatch(
            updateShape({
              id: shapeId,
              changes: { uiSpecData: acc } as Partial<Shape>,
            })
          )
        );

        dispatch(
          updateShape({
            id: shapeId,
            changes: { uiSpecData: html, status: "ready" } as Partial<Shape>,
          })
        );
        toast.success(`Design generated for frame ${frameNumber}`);
      } catch (error) {
        if (placeholderAdded) dispatch(removeShape(shapeId));
        toastGenerationError(error, "Design generation failed. Please try again.");
      } finally {
        markBusy(frame.id, false);
      }
    },
    [dispatch, frameNumberOf, markBusy, projectId, shapes]
  );

  const generateWorkflow = useCallback(
    async (frame: FrameShape, mainShape: GeneratedUIShape) => {
      const mainPageHtml =
        typeof mainShape.uiSpecData === "string" ? mainShape.uiSpecData : "";
      if (!mainPageHtml.trim()) {
        toast.error("Generate a design for this frame first.");
        return;
      }

      markBusy(frame.id, true);
      try {
        // 1. Derive suggested next pages from the main page (spec §7.4).
        const deriveRes = await fetch("/api/generate/workflow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, mainPageHtml, derivePages: true }),
        });
        if (!deriveRes.ok) throw await toGenerationError(deriveRes);
        const { pages } = (await deriveRes.json()) as {
          pages: { name: string; description: string }[];
        };
        if (!pages?.length) {
          toast.info("No follow-up pages were suggested for this design.");
          return;
        }

        // 2. Placeholders laid out left→right after the main design.
        let nextX = mainShape.x + mainShape.width + GENERATED_GAP;
        const jobs = pages.map((page) => {
          const id = uuidv4();
          dispatch(
            addGeneratedUI({
              id,
              type: "generated-ui",
              x: nextX,
              y: mainShape.y,
              width: mainShape.width,
              height: mainShape.height,
              uiSpecData: "",
              sourceFrameId: frame.id,
              name: page.name,
              status: "streaming",
            } satisfies GeneratedUIShape as Shape)
          );
          nextX += mainShape.width + GENERATED_GAP;
          return { id, page };
        });

        toast.info(
          `Generating ${jobs.length} workflow page${jobs.length === 1 ? "" : "s"}…`
        );

        // 3. Stream every page concurrently (spec §7.4).
        const results = await Promise.allSettled(
          jobs.map(async ({ id, page }) => {
            const pageType = `${page.name}: ${page.description}`.slice(0, 200);
            const res = await fetch("/api/generate/workflow", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectId,
                mainPageHtml,
                pageType,
                requestId: uuidv4(),
              }),
            });
            if (!res.ok) throw await toGenerationError(res);

            const html = await readHtmlStream(
              res,
              (acc) =>
                dispatch(
                  updateShape({
                    id,
                    changes: { uiSpecData: acc } as Partial<Shape>,
                  })
                ),
              WORKFLOW_FLUSH_MS
            );
            dispatch(
              updateShape({
                id,
                changes: { uiSpecData: html, status: "ready" } as Partial<Shape>,
              })
            );
          })
        );

        // 4. Mark failures on-canvas + summary toast (success/fail counts).
        let failed = 0;
        results.forEach((result, i) => {
          if (result.status === "rejected") {
            failed += 1;
            dispatch(
              updateShape({
                id: jobs[i].id,
                changes: { status: "error" } as Partial<Shape>,
              })
            );
          }
        });
        const succeeded = results.length - failed;
        if (failed === 0) {
          toast.success(`Workflow complete — ${succeeded} pages generated.`);
        } else {
          const outOfCredits = results.some(
            (r) =>
              r.status === "rejected" &&
              r.reason instanceof GenerationRequestError &&
              r.reason.status === 402
          );
          toast.warning(
            `Workflow finished: ${succeeded} generated, ${failed} failed${outOfCredits ? " (out of credits)" : ""}.`
          );
        }
      } catch (error) {
        toastGenerationError(error, "Workflow generation failed. Please try again.");
      } finally {
        markBusy(frame.id, false);
      }
    },
    [dispatch, markBusy, projectId]
  );

  return { generateDesign, generateWorkflow, busyFrameIds };
}

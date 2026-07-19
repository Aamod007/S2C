import { FrameShape, Shape } from "@/types/shapes";
import { getShapeBounds } from "@/lib/canvas-hit-test";

/**
 * Frame → AI export pipeline (spec §6.7): find the shapes geometrically
 * inside a frame, re-draw them onto an off-screen canvas clipped to the
 * frame bounds, and return a PNG Blob for the /api/generate FormData.
 */

// Output sizing: aim for 2x (or dpr, whichever is larger, capped at 2x)
// but never exceed MAX_EXPORT_PX on the longest edge.
const EXPORT_SCALE = 2;
const MAX_EXPORT_PX = 2000;

/**
 * All sketch shapes whose bounds overlap the frame's bounds. Frames
 * themselves and generated-ui cards are never part of a sketch export.
 */
export function getShapesInsideFrame(
  frame: FrameShape,
  allShapes: Shape[]
): Shape[] {
  return allShapes.filter((s) => {
    if (s.id === frame.id) return false;
    if (s.type === "frame" || s.type === "generated-ui") return false;
    const b = getShapeBounds(s);
    return (
      b.x < frame.x + frame.width &&
      b.x + b.width > frame.x &&
      b.y < frame.y + frame.height &&
      b.y + b.height > frame.y
    );
  });
}

/**
 * Raw Canvas2D re-draw of a single shape, mirroring the render loop in
 * components/canvas/index.tsx — but in pure world space: stroke widths and
 * arrow heads are NOT divided by the viewport scale here, because the
 * export canvas has no screen-constant sizing to preserve.
 */
export function renderShapeOnCanvas(
  ctx: CanvasRenderingContext2D,
  s: Shape
): void {
  ctx.save();
  ctx.globalAlpha = s.opacity ?? 1.0;
  ctx.strokeStyle = s.stroke || "#ffffff";
  ctx.fillStyle = s.fill || "transparent";
  ctx.lineWidth = s.strokeWidth || 2;

  if (s.type === "rectangle" || s.type === "frame") {
    ctx.beginPath();
    ctx.rect(s.x, s.y, s.width, s.height);
    if (s.fill && s.fill !== "transparent") ctx.fill();
    ctx.stroke();
  } else if (s.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(
      s.x + s.width / 2,
      s.y + s.height / 2,
      s.width / 2,
      s.height / 2,
      0,
      0,
      2 * Math.PI
    );
    if (s.fill && s.fill !== "transparent") ctx.fill();
    ctx.stroke();
  } else if (s.type === "line" || s.type === "arrow") {
    ctx.beginPath();
    ctx.moveTo(s.startX, s.startY);
    ctx.lineTo(s.endX, s.endY);
    ctx.stroke();
    if (s.type === "arrow") {
      // Arrow head trig (matches the render loop, world-space head length).
      const angle = Math.atan2(s.endY - s.startY, s.endX - s.startX);
      const headLength = 12;
      ctx.beginPath();
      ctx.moveTo(s.endX, s.endY);
      ctx.lineTo(
        s.endX - headLength * Math.cos(angle - Math.PI / 6),
        s.endY - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(s.endX, s.endY);
      ctx.lineTo(
        s.endX - headLength * Math.cos(angle + Math.PI / 6),
        s.endY - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }
  } else if (s.type === "free-draw") {
    if (s.points.length > 0) {
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    }
  } else if (s.type === "text") {
    const fontSize = s.fontSize ?? 16;
    ctx.fillStyle = s.color || s.stroke || "#ffffff";
    ctx.font =
      `${s.fontStyle ?? ""} ${s.fontWeight ?? ""} ${fontSize}px ${s.fontFamily ?? "sans-serif"}`.trim();
    ctx.textBaseline = "top";
    ctx.fillText(s.text, s.x, s.y);
  }

  ctx.restore();
}

/**
 * Renders the frame's contents to an off-screen canvas (black background,
 * clipped to the frame bounds) and resolves with a PNG Blob (spec §6.7).
 */
export async function generateFrameSnapshot(
  frame: FrameShape,
  allShapes: Shape[]
): Promise<Blob> {
  if (frame.width <= 0 || frame.height <= 0) {
    throw new Error("Frame has no area to export");
  }

  const shapes = getShapesInsideFrame(frame, allShapes);

  // 2x export, shrunk if the frame's longest edge would exceed the pixel cap.
  const longestEdge = Math.max(frame.width, frame.height);
  const scale = Math.min(EXPORT_SCALE, MAX_EXPORT_PX / longestEdge);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(frame.width * scale));
  canvas.height = Math.max(1, Math.round(frame.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D context for frame export");

  // World space: scale to export resolution, origin at the frame's corner.
  ctx.scale(scale, scale);
  ctx.translate(-frame.x, -frame.y);

  // Black background + clip so out-of-frame shape parts are cropped.
  ctx.fillStyle = "#000000";
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  ctx.beginPath();
  ctx.rect(frame.x, frame.y, frame.width, frame.height);
  ctx.clip();

  for (const shape of shapes) {
    renderShapeOnCanvas(ctx, shape);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png", 1.0)
  );
  if (!blob) throw new Error("Frame snapshot export failed (toBlob was null)");
  return blob;
}

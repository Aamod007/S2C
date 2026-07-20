import { Shape } from "@/redux/slices/shapes";

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type HandleCorner = "nw" | "ne" | "sw" | "se";

// Screen-space (px) thresholds — divide by scale to get world-space values.
export const FREE_DRAW_HIT_THRESHOLD = 5;
export const LINE_HIT_THRESHOLD = 8;
export const HANDLE_SIZE = 8;
export const HANDLE_HIT_SLOP = 4;
// World-space padding around a text shape's approximate bounds (text bounds
// are computed in world units, so its padding is too — unlike the thresholds
// above it is NOT divided by scale).
export const TEXT_HIT_PADDING = 4;

const DEFAULT_FONT_SIZE = 16;

/**
 * Normalized bounding box for any shape type.
 * - line/arrow: derived from start/end points
 * - free draw: derived from the points array
 * - text: approximated from text length + font size (no fixed box)
 */
export function getShapeBounds(shape: Shape): Bounds {
  switch (shape.type) {
    case "line":
    case "arrow": {
      const x = Math.min(shape.startX, shape.endX);
      const y = Math.min(shape.startY, shape.endY);
      return {
        x,
        y,
        w: Math.abs(shape.endX - shape.startX),
        h: Math.abs(shape.endY - shape.startY),
      };
    }
    case "freedraw": {
      if (!shape.points || shape.points.length === 0) {
        return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of shape.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case "text": {
      const fontSize = shape.fontSize ?? DEFAULT_FONT_SIZE;
      return {
        x: shape.x - TEXT_HIT_PADDING,
        y: shape.y - TEXT_HIT_PADDING,
        w: shape.text.length * fontSize * 0.6 + TEXT_HIT_PADDING * 2,
        h: fontSize * 1.4 + TEXT_HIT_PADDING * 2,
      };
    }
    default:
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
  }
}

/** Distance from point (px, py) to segment (x1, y1)-(x2, y2). */
export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function isPointInBounds(b: Bounds, wx: number, wy: number): boolean {
  return wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h;
}

/**
 * Per-type point-in-shape test. Coordinates are world-space;
 * `scale` converts the screen-px thresholds into world units.
 */
export function isPointInShape(
  shape: Shape,
  wx: number,
  wy: number,
  scale: number
): boolean {
  switch (shape.type) {
    case "freedraw": {
      const threshold = FREE_DRAW_HIT_THRESHOLD / scale;
      const points = shape.points;
      if (!points || points.length === 0) return false;
      if (points.length === 1) {
        return Math.hypot(wx - points[0].x, wy - points[0].y) <= threshold;
      }
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        if (distanceToSegment(wx, wy, a.x, a.y, b.x, b.y) <= threshold) {
          return true;
        }
      }
      return false;
    }
    case "line":
    case "arrow": {
      const threshold = LINE_HIT_THRESHOLD / scale;
      return (
        distanceToSegment(wx, wy, shape.startX, shape.startY, shape.endX, shape.endY) <=
        threshold
      );
    }
    // frame / rectangle / ellipse / text / generated-ui: bounding-box check
    default:
      return isPointInBounds(getShapeBounds(shape), wx, wy);
  }
}

/**
 * Topmost shape under the point, checked in reverse z-order
 * (shapes array is assumed bottom→top).
 */
export function getShapeAtPoint(
  shapes: Shape[],
  wx: number,
  wy: number,
  scale: number
): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (isPointInShape(shapes[i], wx, wy, scale)) return shapes[i];
  }
  return null;
}

/** World-space centers of the 4 corner resize handles. */
export function getResizeHandles(
  bounds: Bounds
): { corner: HandleCorner; x: number; y: number }[] {
  return [
    { corner: "nw", x: bounds.x, y: bounds.y },
    { corner: "ne", x: bounds.x + bounds.w, y: bounds.y },
    { corner: "sw", x: bounds.x, y: bounds.y + bounds.h },
    { corner: "se", x: bounds.x + bounds.w, y: bounds.y + bounds.h },
  ];
}

/** Which corner handle (if any) is under the world-space point. */
export function getHandleAtPoint(
  bounds: Bounds,
  wx: number,
  wy: number,
  scale: number
): HandleCorner | null {
  const threshold = (HANDLE_SIZE / 2 + HANDLE_HIT_SLOP) / scale;
  for (const handle of getResizeHandles(bounds)) {
    if (Math.abs(wx - handle.x) <= threshold && Math.abs(wy - handle.y) <= threshold) {
      return handle.corner;
    }
  }
  return null;
}

/** Opposite (anchored) corner of the initial bounds for a resize drag. */
export function getAnchorForCorner(
  bounds: Bounds,
  corner: HandleCorner
): { x: number; y: number } {
  switch (corner) {
    case "nw":
      return { x: bounds.x + bounds.w, y: bounds.y + bounds.h };
    case "ne":
      return { x: bounds.x, y: bounds.y + bounds.h };
    case "sw":
      return { x: bounds.x + bounds.w, y: bounds.y };
    case "se":
      return { x: bounds.x, y: bounds.y };
  }
}

/**
 * New bounds from a fixed anchor and the dragged pointer position,
 * normalized so width/height are never negative (dragging past the anchor).
 */
export function boundsFromAnchor(
  anchor: { x: number; y: number },
  px: number,
  py: number
): Bounds {
  return {
    x: Math.min(anchor.x, px),
    y: Math.min(anchor.y, py),
    w: Math.abs(px - anchor.x),
    h: Math.abs(py - anchor.y),
  };
}

/**
 * Per-type resize math (spec §6.5). `baseline` is the shape as it was when
 * the resize started, `initialBounds` its bounds at that moment, `newBounds`
 * the already-normalized target bounds. Returns the changes to dispatch.
 */
export function resizeShape(
  baseline: Shape,
  initialBounds: Bounds,
  newBounds: Bounds
): Partial<Shape> {
  switch (baseline.type) {
    case "freedraw": {
      // Proportionally rescale every point relative to the new bounds.
      const scaleX =
        initialBounds.w === 0 ? 1 : newBounds.w / initialBounds.w;
      const scaleY =
        initialBounds.h === 0 ? 1 : newBounds.h / initialBounds.h;
      return {
        x: newBounds.x,
        y: newBounds.y,
        w: newBounds.w,
        h: newBounds.h,
        points: baseline.points.map((p) => ({
          x: newBounds.x + (p.x - initialBounds.x) * scaleX,
          y: newBounds.y + (p.y - initialBounds.y) * scaleY,
        })),
      } as Partial<Shape>;
    }
    case "line":
    case "arrow": {
      // No intrinsic width/height — map new bounds back onto start/end.
      // Degenerate axes (vertical/horizontal lines) keep both endpoints on
      // the collapsed axis; otherwise preserve the endpoints' relative
      // position within the bounds (t = 0 or 1 per axis).
      const tStartX =
        initialBounds.w === 0
          ? 0.5
          : (baseline.startX - initialBounds.x) / initialBounds.w;
      const tStartY =
        initialBounds.h === 0
          ? 0.5
          : (baseline.startY - initialBounds.y) / initialBounds.h;
      const tEndX =
        initialBounds.w === 0
          ? 0.5
          : (baseline.endX - initialBounds.x) / initialBounds.w;
      const tEndY =
        initialBounds.h === 0
          ? 0.5
          : (baseline.endY - initialBounds.y) / initialBounds.h;
      return {
        x: newBounds.x,
        y: newBounds.y,
        w: newBounds.w,
        h: newBounds.h,
        startX: newBounds.x + tStartX * newBounds.w,
        startY: newBounds.y + tStartY * newBounds.h,
        endX: newBounds.x + tEndX * newBounds.w,
        endY: newBounds.y + tEndY * newBounds.h,
      } as Partial<Shape>;
    }
    case "text": {
      // Text has no intrinsic box — its bounds derive from fontSize, so a
      // resize scales fontSize. Writing raw bounds would (a) shift the shape
      // by the hit padding baked into getShapeBounds and (b) be ignored by
      // the renderer, snapping the selection box back on release.
      const ratio =
        initialBounds.h === 0
          ? 1
          : newBounds.h / initialBounds.h;
      const fontSize = Math.max(
        4,
        (baseline.fontSize ?? DEFAULT_FONT_SIZE) * ratio
      );
      return {
        // Un-pad: shape.x/y is the text origin, bounds are padded outward.
        x: newBounds.x + TEXT_HIT_PADDING,
        y: newBounds.y + TEXT_HIT_PADDING,
        fontSize,
      } as Partial<Shape>;
    }
    case "generatedui":
      // Height is owned by the DOM card's ResizeObserver (content-driven);
      // dispatching it here would fight the observer mid-drag.
      return {
        x: newBounds.x,
        y: newBounds.y,
        w: newBounds.w,
      };
    // rect/ellipse/frame: opposite corner anchors,
    // bounds already normalized by boundsFromAnchor.
    default:
      return {
        x: newBounds.x,
        y: newBounds.y,
        w: newBounds.w,
        h: newBounds.h,
      };
  }
}


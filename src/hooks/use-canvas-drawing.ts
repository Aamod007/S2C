import { RefObject, useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  addRect,
  addEllipse,
  addFrame,
  addLine,
  addArrow,
  addFreeDrawShape,
  updateShape,
  selectShape,
  clearSelection,
  shapesSelectors,
  setTool,
  selectSelectedIds,
  Shape
} from "@/redux/slices/shapes";
import { setTranslate } from "@/redux/slices/viewport";
import { v4 as uuidv4 } from "uuid";

export function useCanvasDrawing(
  containerRef: RefObject<HTMLDivElement | null>
) {
  const dispatch = useAppDispatch();

  const tool = useAppSelector((state) => state.shapes.tool);
  const selectedIds = useAppSelector(selectSelectedIds);
  const viewport = useAppSelector((state) => state.viewport);
  const shapes = useAppSelector(shapesSelectors.selectAll);

  const toolRef = useRef(tool);
  const viewportRef = useRef(viewport);
  const selectedIdsRef = useRef(selectedIds);
  const shapesRef = useRef(shapes);

  toolRef.current = tool;
  viewportRef.current = viewport;
  selectedIdsRef.current = selectedIds;
  shapesRef.current = shapes;

  // Interaction State
  const isInteracting = useRef(false);
  const interactionMode = useRef<"idle" | "drawing" | "panning" | "moving">("idle");
  const startPoint = useRef({ x: 0, y: 0 });
  const startWorldPoint = useRef({ x: 0, y: 0 });
  const currentShapeId = useRef<string | null>(null);

  // Helper to get world coords
  const getWorldPoint = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { scale, translate } = viewportRef.current;
    return {
      x: (x - translate.x) / scale,
      y: (y - translate.y) / scale,
    };
  }, [containerRef]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isInteracting.current = true;
    startPoint.current = { x: e.clientX, y: e.clientY };
    
    const worldPt = getWorldPoint(e);
    startWorldPoint.current = worldPt;

    const t = toolRef.current;

    if (e.button === 1 || t === "select" && e.shiftKey) {
      interactionMode.current = "panning";
      return;
    }

    if (t === "select") {
      // Very basic hit test: check if we clicked inside a shape's bounding box
      // In a real app, you'd use canvas-hit-test.ts here.
      let hitId: string | null = null;
      for (let i = shapesRef.current.length - 1; i >= 0; i--) {
        const s = shapesRef.current[i];
        if ('x' in s && 'y' in s && 'w' in s && 'h' in s) {
           if (worldPt.x >= s.x && worldPt.x <= s.x + s.w &&
               worldPt.y >= s.y && worldPt.y <= s.y + s.h) {
             hitId = s.id;
             break;
           }
        }
      }

      if (hitId) {
        dispatch(selectShape(hitId));
        interactionMode.current = "moving";
        currentShapeId.current = hitId;
      } else {
        dispatch(clearSelection());
        interactionMode.current = "idle";
      }
      return;
    }

    // Creating new shapes
    interactionMode.current = "drawing";
    const base = {
      stroke: "#ffffff",
      strokeWidth: 2,
      fill: "transparent"
    };

    switch (t) {
      case "rect":
        dispatch(addRect({ ...base, x: worldPt.x, y: worldPt.y, w: 0, h: 0 }));
        break;
      case "ellipse":
        dispatch(addEllipse({ ...base, x: worldPt.x, y: worldPt.y, w: 0, h: 0 }));
        break;
      case "frame":
        dispatch(addFrame({ ...base, x: worldPt.x, y: worldPt.y, w: 0, h: 0,  }));
        break;
      case "line":
        dispatch(addLine({ ...base, startX: worldPt.x, startY: worldPt.y, endX: worldPt.x, endY: worldPt.y }));
        break;
      case "arrow":
        dispatch(addArrow({ ...base, startX: worldPt.x, startY: worldPt.y, endX: worldPt.x, endY: worldPt.y }));
        break;
      case "freedraw":
        dispatch(addFreeDrawShape({ ...base, points: [worldPt] }));
        break;
    }
  }, [dispatch, getWorldPoint]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isInteracting.current) return;

    if (interactionMode.current === "panning") {
      const dx = e.clientX - startPoint.current.x;
      const dy = e.clientY - startPoint.current.y;
      dispatch(setTranslate({ x: viewportRef.current.translate.x + dx, y: viewportRef.current.translate.y + dy }));
      startPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const worldPt = getWorldPoint(e);
    const sx = startWorldPoint.current.x;
    const sy = startWorldPoint.current.y;

    if (interactionMode.current === "drawing" && currentShapeId.current) {
      const t = toolRef.current;
      const id = currentShapeId.current || shapesRef.current[shapesRef.current.length - 1]?.id; if (!id) return; currentShapeId.current = id;

      const w = Math.abs(worldPt.x - sx);
      const h = Math.abs(worldPt.y - sy);
      const minX = Math.min(worldPt.x, sx);
      const minY = Math.min(worldPt.y, sy);

      if (t === "rect" || t === "ellipse" || t === "frame") {
        dispatch(updateShape({ id, patch: { x: minX, y: minY, w, h } }));
      } else if (t === "line" || t === "arrow") {
        dispatch(updateShape({ id, patch: { endX: worldPt.x, endY: worldPt.y } }));
      } else if (t === "freedraw") {
        const shape = shapesRef.current.find(s => s.id === id);
        if (shape && shape.type === "freedraw") {
           dispatch(updateShape({ id, patch: { points: [...shape.points, worldPt] } }));
        }
      }
    } else if (interactionMode.current === "moving" && currentShapeId.current) {
      const id = currentShapeId.current || shapesRef.current[shapesRef.current.length - 1]?.id; if (!id) return; currentShapeId.current = id;
      const shape = shapesRef.current.find(s => s.id === id);
      if (shape && 'x' in shape && 'y' in shape) {
        const dx = worldPt.x - startWorldPoint.current.x;
        const dy = worldPt.y - startWorldPoint.current.y;
        dispatch(updateShape({ id, patch: { x: shape.x + dx, y: shape.y + dy } }));
        startWorldPoint.current = worldPt; // reset for next delta
      }
    }
  }, [dispatch, getWorldPoint]);

  const onPointerUp = useCallback(() => {
    isInteracting.current = false;
    interactionMode.current = "idle";
    currentShapeId.current = null;
    
    // Reset to select tool after drawing
    if (toolRef.current !== "select") {
      dispatch(setTool("select"));
    }
  }, [dispatch]);

  // Handle zooming via wheel
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Semantic zoom would be dispatched here
      } else {
        dispatch(setTranslate({ x: viewportRef.current.translate.x - e.deltaX, y: viewportRef.current.translate.y - e.deltaY }));
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [containerRef, dispatch]);

  return { onPointerDown, onPointerMove, onPointerUp };
}

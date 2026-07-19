import { RefObject, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { addRectangle, addEllipse, addFrame, clearSelection } from "@/redux/slices/shapes";
import { screenToWorld } from "@/redux/slices/viewport";
import { Shape } from "@/types/shapes";
import { v4 as uuidv4 } from "uuid";

export function useCanvasDrawing(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  draftShapeRef: React.MutableRefObject<Shape | null>
) {
  const dispatch = useAppDispatch();
  const tool = useAppSelector((state) => state.shapes.tool);
  const viewport = useAppSelector((state) => state.viewport);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getMouseWorldPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      return screenToWorld(clientX, clientY, viewport.scale, viewport.translate);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Only left click

      // Start drawing a shape
      if (tool === "rectangle" || tool === "ellipse" || tool === "frame") {
        isDrawingRef.current = true;
        canvas.setPointerCapture(e.pointerId);

        const worldPos = getMouseWorldPos(e);
        startPointRef.current = worldPos;

        // Initialize draft shape
        draftShapeRef.current = {
          id: uuidv4(),
          type: tool,
          x: worldPos.x,
          y: worldPos.y,
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: "#ffffff",
          strokeWidth: 2,
        } as Shape;

        // If it's a frame, customize it slightly
        if (tool === "frame") {
          draftShapeRef.current.stroke = "#888888";
          draftShapeRef.current.strokeWidth = 1;
        }

        dispatch(clearSelection());
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDrawingRef.current || !startPointRef.current || !draftShapeRef.current) return;

      const worldPos = getMouseWorldPos(e);
      
      // Allow drawing in any direction by adjusting x/y and width/height
      const x = Math.min(startPointRef.current.x, worldPos.x);
      const y = Math.min(startPointRef.current.y, worldPos.y);
      const width = Math.abs(worldPos.x - startPointRef.current.x);
      const height = Math.abs(worldPos.y - startPointRef.current.y);

      draftShapeRef.current = {
        ...draftShapeRef.current,
        x,
        y,
        width,
        height,
      };
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDrawingRef.current || !draftShapeRef.current) return;

      canvas.releasePointerCapture(e.pointerId);
      isDrawingRef.current = false;

      const shape = draftShapeRef.current;
      draftShapeRef.current = null;
      startPointRef.current = null;

      // Only commit if the shape has a decent size to prevent accidental clicks
      if (shape.width > 2 || shape.height > 2) {
        if (shape.type === "rectangle") {
          dispatch(addRectangle(shape as any));
        } else if (shape.type === "ellipse") {
          dispatch(addEllipse(shape as any));
        } else if (shape.type === "frame") {
          dispatch(addFrame(shape as any));
        }
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
    };
  }, [canvasRef, dispatch, tool, viewport, draftShapeRef]);
}

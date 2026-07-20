import { RefObject, useEffect, useRef } from "react";
import { useAppDispatch } from "@/redux/hooks";
import { wheelPan, wheelZoom } from "@/redux/slices/viewport";

export function useInfinityCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const dispatch = useAppDispatch();
  const animationFrameRef = useRef<number>(0);
  const isPanningRef = useRef<boolean>(false);
  const pendingWheelEventRef = useRef<{
    dx: number;
    dy: number;
    zoomDelta: number | null;
    originScreen: { x: 0, y: 0 }, //originScreen: { x: 0, y: 0 }, //clientX: number;
    ////clientY: number;
  }>({
    dx: 0,
    dy: 0,
    zoomDelta: null,
    originScreen: { x: 0, y: 0 }, //originScreen: { x: 0, y: 0 }, //clientX: 0,
    ////clientY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Accumulate wheel events. Store canvas-LOCAL coords — the viewport
      // translate lives in canvas-local space (see getLocalPoint in
      // use-canvas-drawing.ts), so the zoom fixed-point math must too.
      const rect = canvas.getBoundingClientRect();
      pendingWheelEventRef.current.clientX = e.clientX - rect.left;
      pendingWheelEventRef.current.clientY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        if (pendingWheelEventRef.current.zoomDelta === null) {
          pendingWheelEventRef.current.zoomDelta = e.deltaY;
        } else {
          pendingWheelEventRef.current.zoomDelta += e.deltaY;
        }
      } else {
        // Pan
        pendingWheelEventRef.current.dx += e.deltaX;
        pendingWheelEventRef.current.dy += e.deltaY;
      }

      // Schedule update if not already running
      if (!isPanningRef.current) {
        isPanningRef.current = true;
        animationFrameRef.current = requestAnimationFrame(() => {
          const { dx, dy, zoomDelta, clientX, clientY } = pendingWheelEventRef.current;

          if (zoomDelta !== null) {
            dispatch(wheelZoom({ deltaY: zoomDelta, clientX, clientY }));
          }
          if (dx !== 0 || dy !== 0) {
            dispatch(wheelPan({ dx, dy }));
          }

          // Reset pending state
          pendingWheelEventRef.current = {
            dx: 0,
            dy: 0,
            zoomDelta: null,
            originScreen: { x: 0, y: 0 }, //originScreen: { x: 0, y: 0 }, //clientX: 0,
            ////clientY: 0,
          };
          isPanningRef.current = false;
        });
      }
    };

    // Use { passive: false } to prevent default browser zooming/scrolling
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
      // Reset the scheduling guard — a stale `true` would permanently block
      // wheel processing if this effect ever re-runs (HMR, ref change).
      isPanningRef.current = false;
    };
  }, [canvasRef, dispatch]);
}

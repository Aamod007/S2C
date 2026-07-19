"use client";

import { useCallback, useEffect, useRef } from "react";
import { useInfinityCanvas } from "@/hooks/use-canvas";
import { useCanvasDrawing } from "@/hooks/use-canvas-drawing";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { shapesSelectors } from "@/redux/slices/shapes";
import { wheelZoom } from "@/redux/slices/viewport";
import { Shape } from "@/types/shapes";
import { getShapeBounds, getResizeHandles, HANDLE_SIZE } from "@/lib/canvas-hit-test";
import { ZoomOut, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toolbar } from "./Toolbar";
import { TextEditOverlay } from "./text-edit-overlay";
import { TextSidebar } from "./text-sidebar";

export function CanvasContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftShapeRef = useRef<Shape | null>(null);

  // Attach the core event handlers
  useInfinityCanvas(canvasRef);
  const { cursor, editingTextId, setEditingTextId } = useCanvasDrawing(
    canvasRef,
    draftShapeRef
  );

  const dispatch = useAppDispatch();
  const scale = useAppSelector((state) => state.viewport.scale);
  const translate = useAppSelector((state) => state.viewport.translate);
  const shapes = useAppSelector(shapesSelectors.selectAll);
  const selectedIds = useAppSelector((state) => state.shapes.selectedIds);

  // Zoom ± buttons: reuse wheelZoom, anchored at the canvas center.
  const zoomByButton = useCallback(
    (direction: 1 | -1) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dispatch(
        wheelZoom({
          deltaY: direction * -250, // 0.999^-250 ≈ 1.28x per click
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        })
      );
    },
    [dispatch]
  );

  // Drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;

      // Handle resizing cleanly
      const { clientWidth, clientHeight } = canvas.parentElement || canvas;
      if (
        canvas.width !== clientWidth * dpr ||
        canvas.height !== clientHeight * dpr
      ) {
        canvas.width = clientWidth * dpr;
        canvas.height = clientHeight * dpr;
        canvas.style.width = `${clientWidth}px`;
        canvas.style.height = `${clientHeight}px`;
      }

      // Clear the full backing surface with an identity transform, then set
      // the dpr transform absolutely (never cumulative ctx.scale).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.save();

      // Apply viewport transform
      ctx.translate(translate.x, translate.y);
      ctx.scale(scale, scale);

      // --- Draw Grid ---
      const gridSize = 50;
      const startX = Math.floor(-translate.x / scale / gridSize) * gridSize;
      const startY = Math.floor(-translate.y / scale / gridSize) * gridSize;
      const endX = startX + (canvas.clientWidth / scale) + gridSize * 2;
      const endY = startY + (canvas.clientHeight / scale) + gridSize * 2;

      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1 / scale;

      for (let x = startX; x < endX; x += gridSize) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = startY; y < endY; y += gridSize) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();

      // Draw origin marker
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      ctx.lineWidth = 2 / scale;
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 10);
      ctx.stroke();

      // --- Draw Shapes ---
      const drawArrowHead = (
        fromX: number,
        fromY: number,
        toX: number,
        toY: number
      ) => {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const headLength = 12 / scale;
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - headLength * Math.cos(angle - Math.PI / 6),
          toY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - headLength * Math.cos(angle + Math.PI / 6),
          toY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      };

      const drawShape = (s: Shape, isDraft = false) => {
        ctx.save();
        ctx.globalAlpha = isDraft ? 0.5 : (s.opacity ?? 1.0);
        ctx.strokeStyle = s.stroke || "#ffffff";
        ctx.fillStyle = s.fill || "transparent";
        ctx.lineWidth = (s.strokeWidth || 2) / scale;

        if (s.type === "rectangle" || s.type === "frame") {
          ctx.beginPath();
          ctx.rect(s.x, s.y, s.width, s.height);
          if (s.fill !== "transparent") ctx.fill();
          ctx.stroke();

          if (s.type === "frame") {
             // Draw a subtle fill for frames
             ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
             ctx.fill();
             // Draw frame label (simulated for now)
             ctx.fillStyle = "#888888";
             ctx.font = `${12 / scale}px sans-serif`;
             ctx.fillText(s.label ?? s.id.slice(0, 6), s.x, s.y - (4 / scale));
          }
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
          if (s.fill !== "transparent") ctx.fill();
          ctx.stroke();
        } else if (s.type === "line" || s.type === "arrow") {
          ctx.beginPath();
          ctx.moveTo(s.startX, s.startY);
          ctx.lineTo(s.endX, s.endY);
          ctx.stroke();
          if (s.type === "arrow") {
            drawArrowHead(s.startX, s.startY, s.endX, s.endY);
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
          ctx.font = `${s.fontStyle ?? ""} ${s.fontWeight ?? ""} ${fontSize}px ${s.fontFamily ?? "sans-serif"}`.trim();
          ctx.textBaseline = "top";
          ctx.fillText(s.text, s.x, s.y);
        } else if (s.type === "generated-ui") {
          // Placeholder box until the DOM-rendered generated UI lands.
          ctx.beginPath();
          ctx.rect(s.x, s.y, s.width, s.height);
          ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      };

      // Draw committed shapes (the one being text-edited renders as an HTML
      // overlay instead, so skip it here to avoid a double image).
      shapes.forEach((s) => {
        if (s.id !== editingTextId) drawShape(s);
      });

      // Draw draft shape
      if (draftShapeRef.current) {
        drawShape(draftShapeRef.current, true);
      }

      // --- Selection overlay: bounding box + corner handles ---
      if (selectedIds.length > 0) {
        const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
        const pad = 2 / scale; // small screen-space breathing room
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5 / scale;

        for (const s of selectedShapes) {
          const b = getShapeBounds(s);
          ctx.strokeRect(
            b.x - pad,
            b.y - pad,
            b.width + pad * 2,
            b.height + pad * 2
          );
        }

        // Corner resize handles: only for a single selected shape, with a
        // constant screen-space size regardless of zoom.
        if (selectedShapes.length === 1) {
          const b = getShapeBounds(selectedShapes[0]);
          const size = HANDLE_SIZE / scale;
          ctx.fillStyle = "#ffffff";
          for (const h of getResizeHandles(b)) {
            ctx.beginPath();
            ctx.rect(h.x - size / 2, h.y - size / 2, size, size);
            ctx.fill();
            ctx.stroke();
          }
        }
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [scale, translate, shapes, selectedIds, editingTextId]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
      <Toolbar />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none outline-none"
        style={{ cursor }}
        tabIndex={0}
      />

      {editingTextId && (
        <TextEditOverlay
          key={editingTextId}
          editingTextId={editingTextId}
          onDone={() => setEditingTextId(null)}
        />
      )}
      <TextSidebar />

      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-md border border-border/50 bg-background/80 p-1 shadow-sm backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => zoomByButton(-1)}
        >
          <ZoomOut className="h-3 w-3" />
        </Button>
        <span className="w-12 text-center text-xs font-medium tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => zoomByButton(1)}
        >
          <ZoomIn className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

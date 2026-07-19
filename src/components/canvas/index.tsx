"use client";

import { useEffect, useRef } from "react";
import { useInfinityCanvas } from "@/hooks/use-canvas";
import { useCanvasDrawing } from "@/hooks/use-canvas-drawing";
import { useAppSelector } from "@/redux/hooks";
import { shapesSelectors } from "@/redux/slices/shapes";
import { Shape } from "@/types/shapes";
import { ZoomOut, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toolbar } from "./Toolbar";

export function CanvasContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftShapeRef = useRef<Shape | null>(null);
  
  // Attach the core event handlers
  useInfinityCanvas(canvasRef);
  useCanvasDrawing(canvasRef, draftShapeRef);
  
  const scale = useAppSelector((state) => state.viewport.scale);
  const translate = useAppSelector((state) => state.viewport.translate);
  const shapes = useAppSelector(shapesSelectors.selectAll);

  // Drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Handle resizing cleanly
      const { clientWidth, clientHeight } = canvas.parentElement || canvas;
      if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = clientWidth * dpr;
        canvas.height = clientHeight * dpr;
        canvas.style.width = `${clientWidth}px`;
        canvas.style.height = `${clientHeight}px`;
        ctx.scale(dpr, dpr);
      } else {
        // Clear previous frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

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
      const drawShape = (s: Shape, isDraft = false) => {
        ctx.save();
        ctx.globalAlpha = isDraft ? 0.5 : 1.0;
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
             ctx.fillText(s.id.slice(0, 6), s.x, s.y - (4 / scale));
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
        }
        
        ctx.restore();
      };

      // Draw committed shapes
      shapes.forEach((s) => drawShape(s));

      // Draw draft shape
      if (draftShapeRef.current) {
        drawShape(draftShapeRef.current, true);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [scale, translate, shapes]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-950">
      <Toolbar />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none outline-none cursor-crosshair"
        tabIndex={0}
      />
      
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-md border border-border/50 bg-background/80 p-1 shadow-sm backdrop-blur">
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <ZoomOut className="h-3 w-3" />
        </Button>
        <span className="w-12 text-center text-xs font-medium tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <ZoomIn className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

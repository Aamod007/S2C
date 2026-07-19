"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Download, Loader2, MessageSquare, Trash2, TriangleAlert } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { removeShape, shapesSelectors, updateShape } from "@/redux/slices/shapes";
import { removeChat } from "@/redux/slices/chat";
import { GeneratedUIShape, Shape } from "@/types/shapes";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { Button } from "@/components/ui/button";

/** World-px height of the card chrome above the rendered HTML. */
const HEADER_HEIGHT = 32;
/** Minimum world-px difference before auto-height dispatches an update. */
const HEIGHT_EPSILON = 2;

/** Strips markdown code fences the model sometimes wraps around the HTML. */
function stripCodeFences(html: string): string {
  return html
    .replace(/^\s*```(?:html)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "");
}

/**
 * DOM layer for generated-ui shapes (spec §7.2 steps 6-8). Renders each
 * shape's sanitized HTML as a positioned card inside a container that
 * mirrors the canvas viewport transform (translate + scale, origin 0 0),
 * so the same world coordinates work for both layers.
 *
 * Pointer-events contract: the container and card bodies are
 * `pointer-events: none`, so drawing/selecting/moving over a card still
 * hits the <canvas> underneath (hit-test handles generated-ui bounds).
 * Only the header chrome re-enables pointer events for its buttons.
 */
export function GeneratedUIOverlay({
  projectName,
  onToggleChat,
  activeChatShapeId,
}: {
  projectName: string;
  onToggleChat: (shapeId: string) => void;
  activeChatShapeId: string | null;
}) {
  const scale = useAppSelector((state) => state.viewport.scale);
  const translate = useAppSelector((state) => state.viewport.translate);
  const shapes = useAppSelector(shapesSelectors.selectAll);

  const cards = shapes.filter(
    (s): s is GeneratedUIShape => s.type === "generated-ui"
  );
  if (cards.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden={false}
    >
      <div
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {cards.map((shape, index) => (
          <GeneratedUICard
            key={shape.id}
            shape={shape}
            screenNumber={index + 1}
            projectName={projectName}
            onToggleChat={onToggleChat}
            isChatOpen={activeChatShapeId === shape.id}
          />
        ))}
      </div>
    </div>
  );
}

const GeneratedUICard = memo(function GeneratedUICard({
  shape,
  screenNumber,
  projectName,
  onToggleChat,
  isChatOpen,
}: {
  shape: GeneratedUIShape;
  screenNumber: number;
  projectName: string;
  onToggleChat: (shapeId: string) => void;
  isChatOpen: boolean;
}) {
  const dispatch = useAppDispatch();
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef(shape.height);

  const html = typeof shape.uiSpecData === "string" ? shape.uiSpecData : "";
  const isStreaming = shape.status === "streaming";
  const isError = shape.status === "error";

  // Sanitize once per HTML snapshot (throttled upstream to ~10/s while
  // streaming); memo keeps other cards from re-sanitizing on unrelated updates.
  const safeHtml = useMemo(() => sanitizeHtml(stripCodeFences(html)), [html]);

  // Auto-height (spec §7.2.8): the card is inside the scale() container, so
  // its layout size IS world units — a ResizeObserver on the card gives us
  // content-driven height with no polling and no /scale math. Fires as the
  // streamed HTML grows and once more when it settles.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const measured = el.offsetHeight;
      if (
        measured > 0 &&
        Math.abs(measured - lastHeightRef.current) > HEIGHT_EPSILON
      ) {
        lastHeightRef.current = measured;
        dispatch(
          updateShape({
            id: shape.id,
            changes: { height: measured } as Partial<Shape>,
          })
        );
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [dispatch, shape.id]);

  const handleExport = async () => {
    const node = contentRef.current;
    if (!node || !html.trim()) {
      toast.error("Nothing to export yet.");
      return;
    }
    try {
      // html-to-image measures offsetWidth/Height, which ignore the ancestor
      // scale() transform — the export is always at natural (world) size.
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#09090b",
      });
      const slug =
        projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "project";
      const link = document.createElement("a");
      link.download = `${slug}-screen-${screenNumber}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(`Exported screen ${screenNumber}`);
    } catch (error) {
      console.error("[export] toPng failed:", error);
      toast.error("PNG export failed. Please try again.");
    }
  };

  const handleDelete = () => {
    dispatch(removeShape(shape.id));
    dispatch(removeChat(shape.id));
  };

  return (
    <div
      ref={cardRef}
      className="pointer-events-none absolute flex flex-col overflow-hidden rounded-lg border border-border/60 bg-background shadow-xl"
      style={{
        left: shape.x,
        top: shape.y,
        width: shape.width,
        minHeight: HEADER_HEIGHT,
        opacity: shape.opacity ?? 1,
      }}
    >
      {/* Header chrome — the only pointer-interactive part of the card. */}
      <div
        className="pointer-events-auto flex shrink-0 items-center gap-1 border-b border-border/60 bg-muted/60 px-2"
        style={{ height: HEADER_HEIGHT }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="truncate text-xs font-medium text-muted-foreground">
          {shape.name ?? `Screen ${screenNumber}`}
        </span>
        {isStreaming && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            generating…
          </span>
        )}
        {isError && (
          <span className="flex items-center gap-1 text-[10px] text-destructive">
            <TriangleAlert className="h-3 w-3" />
            failed
          </span>
        )}
        <div className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 ${isChatOpen ? "text-primary" : ""}`}
            title="Chat redesign"
            onClick={() => onToggleChat(shape.id)}
          >
            <MessageSquare className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Export PNG"
            disabled={isStreaming}
            onClick={handleExport}
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:text-destructive"
            title="Delete"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Rendered (sanitized) generated HTML — inert to the pointer so the
          canvas tools keep working over the card body. */}
      <div ref={contentRef} className="relative overflow-hidden bg-background">
        {safeHtml ? (
          <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
        ) : (
          <div
            className="flex items-center justify-center text-xs text-muted-foreground"
            style={{ height: Math.max(shape.height - HEADER_HEIGHT, 120) }}
          >
            {isError ? "Generation failed" : "Waiting for design…"}
          </div>
        )}
        {isStreaming && safeHtml && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
            <Loader2 className="h-3 w-3 animate-spin" />
            generating…
          </div>
        )}
      </div>
    </div>
  );
});

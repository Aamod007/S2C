"use client";

import { Loader2, Sparkles, Workflow } from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { shapesSelectors } from "@/redux/slices/shapes";
import { worldToScreen } from "@/redux/slices/viewport";
import { FrameShape, GeneratedUIShape } from "@/redux/slices/shapes";
import { useFrame } from "@/hooks/use-frame";
import { Button } from "@/components/ui/button";

/**
 * Floating actions for a single selected frame (spec §7.2 / §7.4 triggers):
 * "✨ Generate Design" always, plus "Generate Workflow" once the frame has at
 * least one completed generated design. Screen-positioned just above the
 * frame via world→screen so it tracks pan/zoom.
 */
export function FrameActionButtons({ projectId }: { projectId: string }) {
  const scale = useAppSelector((state) => state.viewport.scale);
  const translate = useAppSelector((state) => state.viewport.translate);
  const selectedIds = useAppSelector((state) => Object.keys(state.shapes.selected));
  const shapes = useAppSelector(shapesSelectors.selectAll);

  const { generateDesign, generateWorkflow, busyFrameIds } = useFrame(projectId);

  if (selectedIds.length !== 1) return null;
  const frame = shapes.find((s) => s.id === selectedIds[0]);
  if (!frame || frame.type !== "frame") return null;

  const isBusy = busyFrameIds.includes(frame.id);

  // First completed design generated from this frame → workflow source page.
  const mainDesign = shapes.find(
    (s): s is GeneratedUIShape =>
      s.type === "generatedui" &&
      s.sourceFrameId === frame.id &&
      typeof s.uiSpecData === "string" &&
      s.uiSpecData.trim().length > 0 &&
      s.status !== "streaming" &&
      s.status !== "error"
  );

  const screen = worldToScreen(
    frame.x + frame.w / 2,
    frame.y,
    scale,
    translate
  );

  return (
    <div
      className="absolute z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border/50 bg-background/90 p-1 shadow-md backdrop-blur"
      style={{ left: screen.x, top: Math.max(screen.y - 44, 8) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs"
        disabled={isBusy}
        onClick={() => generateDesign(frame as FrameShape)}
      >
        {isBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        Generate Design
      </Button>
      {mainDesign && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={isBusy}
          onClick={() => generateWorkflow(frame as FrameShape, mainDesign)}
        >
          <Workflow className="h-3.5 w-3.5" />
          Generate Workflow
        </Button>
      )}
    </div>
  );
}


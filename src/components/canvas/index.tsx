"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { shapesSelectors, selectSelectedIds, selectShape, Shape } from "@/redux/slices/shapes";
import { GeneratedUIOverlay } from "./generated-ui-overlay";
import { FrameActionButtons } from "./frame-action-buttons";
import { ChatPanel } from "./chat-panel";
import { useAutosaveContext } from "@/components/projects/provider";
import { useCanvasDrawing } from "@/hooks/use-canvas-drawing";

// Import all custom shape components from boilerplate
import { Arrow } from "./shapes/arrow";
import { Elipse as Ellipse } from "./shapes/elipse"; // spelled elipse in boilerplate
import { Frame } from "./shapes/frame";
import { Line } from "./shapes/line";
import { Rectangle } from "./shapes/rectangle";
import { Stroke as FreeDraw } from "./shapes/stroke";
import { Text } from "./shapes/text";


export function CanvasContainer({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const dispatch = useAppDispatch();
  const autosave = useAutosaveContext();
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeChatShapeId, setActiveChatShapeId] = useState<string | null>(null);
  const toggleChat = useCallback(
    (shapeId: string) => setActiveChatShapeId((c) => (c === shapeId ? null : shapeId)),
    []
  );

  const shapes = useAppSelector(shapesSelectors.selectAll);
  const selectedIds = useAppSelector(selectSelectedIds);
  const viewport = useAppSelector((state) => state.viewport);

  // Autosave notification hook
  useEffect(() => {
    autosave?.notifyChange();
  }, [shapes, viewport, autosave]);

  // Hook up the custom canvas drawing and interaction logic
  const { onPointerDown, onPointerMove, onPointerUp } = useCanvasDrawing(containerRef);

  const storedProjectName = useAppSelector(
    (state) => state.projects.projects.find((p) => p._id === projectId)?.name
  );

  const renderShape = (shape: Shape) => {
    switch (shape.type) {
      case "rect":
        return <Rectangle key={shape.id} shape={shape} />;
      case "ellipse":
        return <Ellipse key={shape.id} shape={shape} />;
      case "frame":
        return <Frame key={shape.id} shape={shape} />;
      case "line":
        return <Line key={shape.id} shape={shape} />;
      case "arrow":
        return <Arrow key={shape.id} shape={shape} />;
      case "freedraw":
        return <FreeDraw key={shape.id} shape={shape} />;
      case "text":
        return <Text key={shape.id} shape={shape} />;
      case "generatedui":
        // Handled by GeneratedUIOverlay
        return null;
      default:
        return null;
    }
  };

  // Find selected frame for action buttons
  const selectedFrameId =
    selectedIds.length === 1 && shapes.find((s) => s.id === selectedIds[0] && s.type === "frame")
      ? selectedIds[0]
      : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-neutral-900 text-white touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{
        cursor: viewport.mode === "panning" ? "grabbing" : "default",
      }}
    >
      <div
        className="absolute origin-top-left will-change-transform pointer-events-none"
        style={{
          transform: `translate(${viewport.translate.x}px, ${viewport.translate.y}px) scale(${viewport.scale})`,
        }}
      >
        {shapes.map(renderShape)}

        
      </div>

      <GeneratedUIOverlay
        projectName={storedProjectName ?? projectName ?? "project"}
        onToggleChat={toggleChat}
        activeChatShapeId={activeChatShapeId}
      />

      {selectedFrameId && (
        <FrameActionButtons projectId={projectId} />
      )}

      {activeChatShapeId && (
        <ChatPanel
          key={activeChatShapeId}
          shapeId={activeChatShapeId}
          projectId={projectId}
          onClose={() => setActiveChatShapeId(null)}
        />
      )}
    </div>
  );
}

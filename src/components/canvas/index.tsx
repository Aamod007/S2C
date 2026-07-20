"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";


import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { shapesSelectors, addFrame, selectShape } from "@/redux/slices/shapes";
import { GeneratedUIOverlay } from "./generated-ui-overlay";
import { FrameActionButtons } from "./frame-action-buttons";
import { ChatPanel } from "./chat-panel";
import { useAutosaveContext } from "@/components/projects/provider";
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  { ssr: false }
);

export function CanvasContainer({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const dispatch = useAppDispatch();
  const { resolvedTheme } = useTheme();
  const autosave = useAutosaveContext();

  const [excalidrawAPI, setExcalidrawAPI] =
    useState<any | null>(null);
  const [activeChatShapeId, setActiveChatShapeId] = useState<string | null>(null);
  const toggleChat = useCallback(
    (shapeId: string) =>
      setActiveChatShapeId((c) => (c === shapeId ? null : shapeId)),
    []
  );

  // Store elements in a ref — never dispatch to Redux on every change.
  const elementsRef = useRef<readonly any[]>([]);
  const appStateRef = useRef<Partial<any>>({});

  const handleChange = useCallback(
    (elements: readonly any[], appState: any) => {
      elementsRef.current = elements;
      appStateRef.current = {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom,
      };
      autosave?.notifyChange();
    },
    [autosave]
  );

  // Hydrate Excalidraw from persisted sketches_data on first mount.
  const shapes = useAppSelector(shapesSelectors.selectAll);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !excalidrawAPI || shapes.length === 0) return;
    const first = shapes[0] as unknown as Record<string, unknown>;
    if (typeof first.id === "string" && typeof first.type === "string") {
      hydratedRef.current = true;
      excalidrawAPI.updateScene({
        elements: shapes as unknown as any[],
      });
    }
  }, [excalidrawAPI, shapes]);

  // Expose elements getter for autosave hook.
  useEffect(() => {
    const key = `__excalidraw_elements_${projectId}`;
    (window as any)[key] = () => ({
      elements: elementsRef.current,
      appState: appStateRef.current,
    });
    return () => {
      delete (window as any)[key];
    };
  }, [projectId]);

  // Track selected frame for AI generation buttons.
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const handlePointerUp = useCallback(() => {
    if (!excalidrawAPI) return;
    const appState = excalidrawAPI.getAppState();
    const selected = excalidrawAPI
      .getSceneElements()
      .filter((el: any) => appState.selectedElementIds[el.id]);
    const frame = selected.find(
      (el: any) => el.type === "frame"
    ) as any | undefined;
    setSelectedFrameId(frame?.id ?? null);
  }, [excalidrawAPI]);

  const storedProjectName = useAppSelector(
    (state) => state.projects.projects.find((p) => p._id === projectId)?.name
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onPointerUp={handlePointerUp}
    >
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        theme={resolvedTheme === "light" ? "light" : "dark"}
        UIOptions={{
          canvasActions: {
            saveToActiveFile: false,
            loadScene: false,
          },
        }}
      />

      <GeneratedUIOverlay
        projectName={storedProjectName ?? projectName ?? "project"}
        onToggleChat={toggleChat}
        activeChatShapeId={activeChatShapeId}
      />

      {selectedFrameId && excalidrawAPI && (
        <ExcalidrawFrameActions
          projectId={projectId}
          frameId={selectedFrameId}
          excalidrawAPI={excalidrawAPI}
        />
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

function ExcalidrawFrameActions({
  projectId,
  frameId,
  excalidrawAPI,
}: {
  projectId: string;
  frameId: string;
  excalidrawAPI: any;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const el = excalidrawAPI
      .getSceneElements()
      .find((e: any) => e.id === frameId && e.type === "frame") as
      | any
      | undefined;
    if (!el) return;

    const frameShape = {
      id: el.id,
      type: "frame" as const,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      label: el.name ?? undefined,
      stroke: "#888888",
      strokeWidth: 1,
      fill: "transparent",
      opacity: 1,
    };

    dispatch(addFrame(frameShape as Parameters<typeof addFrame>[0]));
    dispatch(selectShape(frameId));
  }, [dispatch, excalidrawAPI, frameId]);

  return <FrameActionButtons projectId={projectId} />;
}

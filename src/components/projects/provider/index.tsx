"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAppDispatch } from "@/redux/hooks";
import { loadProject } from "@/redux/slices/shapes";
import { upsertProject } from "@/redux/slices/projects";
import type { Shape } from "@/redux/slices/shapes";
import { useAutosave, type AutosaveStatus } from "@/hooks/use-autosave";
import { AutosaveIndicator } from "@/components/canvas/autosave";

interface AutosaveContextValue {
  status: AutosaveStatus;
  retry: () => void;
  /** Stable — safe to call from Excalidraw's onChange at pointer frequency. */
  notifyChange: () => void;
  /** Seeds the save baseline; called by the canvas after Excalidraw hydrates. */
  markLoaded: () => void;
}

const AutosaveContext = createContext<AutosaveContextValue | null>(null);

export function useAutosaveContext() {
  return useContext(AutosaveContext);
}

export function AutosaveStatusBadge() {
  const ctx = useAutosaveContext();
  if (!ctx) return null;
  return <AutosaveIndicator status={ctx.status} onRetry={ctx.retry} />;
}

export function ProjectProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const dispatch = useAppDispatch();
  const project = useQuery(api.projects.getById, {
    projectId: projectId as Id<"projects">,
  });

  const hydratedRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const { status, retry, markLoaded, notifyChange } = useAutosave(
    projectId,
    hydrated
  );

  useEffect(() => {
    if (project === undefined) return;
    if (project === null) return;
    if (hydratedRef.current === projectId) return;
    hydratedRef.current = projectId;

    dispatch(
      upsertProject({
        _id: project._id,
        name: project.name,
        description: project.description,
        project_number: project.project_number,
        last_modified: project.last_modified,
        created_at: project.created_at,
      })
    );

    const rawSketches: Shape[] = Array.isArray(project.sketches_data)
      ? (project.sketches_data as Shape[])
      : [];
    const sketches: Shape[] = rawSketches.map((s) =>
      s.type === "generatedui" && (s as any).status === "streaming"
        ? { ...s, status: (s as any).uiSpecData ? "ready" : "error" }
        : s
    );
    dispatch(loadProject({ shapes: { ids: sketches.map((s) => s.id), entities: Object.fromEntries(sketches.map((s) => [s.id, s])) }, tool: "select", selected: {}, frameCounter: 0 }));

    setHydrated(true);
  }, [project, projectId, dispatch]);

  // markLoaded must run AFTER the canvas has hydrated Excalidraw and
  // registered its elements getter — CanvasContainer calls it via context
  // once updateScene has run. Until then the baseline stays null and
  // notifyChange is a no-op (enabled gate).
  const value = useMemo(
    () => ({ status, retry, notifyChange, markLoaded }),
    [status, retry, notifyChange, markLoaded]
  );

  return (
    <AutosaveContext.Provider value={value}>
      {children}
    </AutosaveContext.Provider>
  );
}


"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAppDispatch } from "@/redux/hooks";
import { loadProject } from "@/redux/slices/shapes";
import {
  setViewport,
  resetViewport,
  type ViewportState,
} from "@/redux/slices/viewport";
import type { Shape } from "@/types/shapes";
import { useAutosave, type AutosaveStatus } from "@/hooks/use-autosave";
import { AutosaveIndicator } from "@/components/canvas/autosave";

interface AutosaveContextValue {
  status: AutosaveStatus;
  retry: () => void;
}

const AutosaveContext = createContext<AutosaveContextValue | null>(null);

export function useAutosaveContext() {
  return useContext(AutosaveContext);
}

// Connected status badge for the workspace header — renders nothing until the
// provider is mounted (e.g. during SSR or outside the workspace).
export function AutosaveStatusBadge() {
  const ctx = useAutosaveContext();
  if (!ctx) return null;
  return <AutosaveIndicator status={ctx.status} onRetry={ctx.retry} />;
}

const DEFAULT_VIEWPORT: ViewportState = {
  scale: 1,
  translate: { x: 0, y: 0 },
};

/**
 * Project persistence provider (spec §9 round-trip). Mounted in the workspace
 * layout, keyed by projectId so refs reset on project switch:
 *
 * 1. Fetches the project via Convex (live query).
 * 2. ONCE per project mount, hydrates Redux: loadProject(sketches_data) +
 *    setViewport(viewport_data). The `hydratedRef` guard is critical — the
 *    live query refires after every autosave round-trip, and re-dispatching
 *    then would clobber in-progress local edits.
 * 3. Runs the autosave hook, enabled only after hydration, with its baseline
 *    snapshot seeded from the loaded data so the load itself never triggers
 *    a save.
 */
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
  const { status, retry, markLoaded } = useAutosave(projectId, hydrated);

  useEffect(() => {
    if (project === undefined) return; // query still loading
    if (project === null) return; // not found / unauthorized — never enable saving
    if (hydratedRef.current === projectId) return; // live-query refire — ignore
    hydratedRef.current = projectId;

    const rawSketches: Shape[] = Array.isArray(project.sketches_data)
      ? (project.sketches_data as Shape[])
      : [];
    // A snapshot persisted mid-generation carries status: "streaming" —
    // the stream died with the old tab, so downgrade to a terminal state.
    // Partial HTML → "ready" (still viewable); empty → "error".
    const sketches: Shape[] = rawSketches.map((s) =>
      s.type === "generated-ui" && s.status === "streaming"
        ? { ...s, status: s.uiSpecData ? "ready" : "error" }
        : s
    );
    dispatch(loadProject(sketches));

    // Normalize viewport_data down to exactly { scale, translate: { x, y } }
    // so the autosave baseline snapshot stringifies identically to what the
    // hook will serialize from the store after these dispatches.
    const rawVp = project.viewport_data as Partial<ViewportState> | undefined;
    const vp: ViewportState =
      rawVp &&
      typeof rawVp.scale === "number" &&
      typeof rawVp.translate?.x === "number" &&
      typeof rawVp.translate?.y === "number"
        ? {
            scale: rawVp.scale,
            translate: { x: rawVp.translate.x, y: rawVp.translate.y },
          }
        : DEFAULT_VIEWPORT;
    if (vp === DEFAULT_VIEWPORT) {
      dispatch(resetViewport());
    } else {
      dispatch(setViewport(vp));
    }

    markLoaded({ sketchesData: sketches, viewportData: vp });
    setHydrated(true);
  }, [project, projectId, dispatch, markLoaded]);

  return (
    <AutosaveContext.Provider value={{ status, retry }}>
      {children}
    </AutosaveContext.Provider>
  );
}

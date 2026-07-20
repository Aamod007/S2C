"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1500;
const SAVED_RESET_MS = 2000;

/**
 * Autosave hook for the Excalidraw canvas.
 *
 * Design constraint: Excalidraw fires onChange on every pointer move, so
 * NOTHING in the notify path may call setState or produce a new render —
 * otherwise the canvas re-renders, Excalidraw re-fires, and React hits
 * "Maximum update depth exceeded". `notifyChange` is therefore a stable
 * callback that only touches refs and a timer; the only setState calls are
 * the at-most-once-per-save status transitions.
 *
 * Elements are read at save time from the getter CanvasContainer registers
 * on window (`__excalidraw_elements_${projectId}`), never from React state.
 */
export function useAutosave(projectId: string, enabled: boolean) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const lastSavedRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastStampRef = useRef(0);

  const nextSavedAt = useCallback(() => {
    const stamp = Math.max(Date.now(), lastStampRef.current + 1);
    lastStampRef.current = stamp;
    return stamp;
  }, []);

  const getSnapshot = useCallback((): string | null => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getter = (window as any)[`__excalidraw_elements_${projectId}`] as
      | (() => { elements: unknown; appState: unknown })
      | undefined;
    if (!getter) return null;
    const { elements, appState } = getter();
    return JSON.stringify({ sketchesData: elements, viewportData: appState });
  }, [projectId]);

  // Called once after hydration so the initial load doesn't count as a change.
  const markLoaded = useCallback(() => {
    lastSavedRef.current = getSnapshot();
  }, [getSnapshot]);

  const performSave = useCallback(async () => {
    const payload = getSnapshot();
    if (!payload || payload === lastSavedRef.current) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("saving");
    try {
      const { sketchesData, viewportData } = JSON.parse(payload);
      const res = await fetch("/api/project", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sketchesData,
          viewportData,
          savedAt: nextSavedAt(),
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Autosave failed: ${res.status}`);

      lastSavedRef.current = payload;
      setStatus("saved");
      if (savedResetRef.current) clearTimeout(savedResetRef.current);
      savedResetRef.current = setTimeout(
        () => setStatus((s) => (s === "saved" ? "idle" : s)),
        SAVED_RESET_MS
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("Autosave error:", error);
      setStatus("error");
    }
  }, [getSnapshot, projectId, nextSavedAt]);

  // STABLE debounce trigger — refs and a timer only, no setState. Safe to
  // call from Excalidraw's onChange at pointer-move frequency.
  const performSaveRef = useRef(performSave);
  performSaveRef.current = performSave;
  const notifyChange = useCallback(() => {
    if (!enabledRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void performSaveRef.current();
    }, DEBOUNCE_MS);
  }, []);

  // Flush on unmount / project switch.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedResetRef.current) clearTimeout(savedResetRef.current);
      abortRef.current?.abort();
      if (!enabledRef.current || lastSavedRef.current === null) return;
      const payload = getSnapshot();
      if (!payload || payload === lastSavedRef.current) return;
      try {
        const { sketchesData, viewportData } = JSON.parse(payload);
        void fetch("/api/project", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            sketchesData,
            viewportData,
            savedAt: Math.max(Date.now(), lastStampRef.current + 1),
          }),
          keepalive: true,
        });
      } catch {
        // best-effort
      }
    };
  }, [projectId, getSnapshot]);

  const retry = useCallback(() => void performSaveRef.current(), []);

  return { status, retry, markLoaded, notifyChange };
}

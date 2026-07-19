"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "@/redux/hooks";
import { shapesSelectors } from "@/redux/slices/shapes";
import type { Shape } from "@/types/shapes";
import type { ViewportState } from "@/redux/slices/viewport";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1000;
const SAVED_RESET_MS = 2000;

// Serialized payload persisted as sketches_data / viewport_data. Shapes are
// stored as a plain Shape[] — exactly what loadProject (adapter setAll)
// expects back on the next load.
export interface AutosaveSnapshot {
  sketchesData: Shape[];
  viewportData: ViewportState;
}

/**
 * Autosave hook (spec §9). Watches shapes + viewport Redux state, debounces
 * ~1s after the last change, skips no-ops via JSON snapshot comparison, and
 * PATCHes /api/project with an AbortController cancelling in-flight saves.
 *
 * `enabled` gates saving until the initial project load has been dispatched;
 * call `markLoaded` with the just-loaded data so the baseline snapshot equals
 * what came from the server (we never save what we just loaded).
 */
export function useAutosave(projectId: string, enabled: boolean) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");

  const shapes = useAppSelector(shapesSelectors.selectAll);
  const viewport = useAppSelector((state) => state.viewport);

  // Memoized serialization — shapes/viewport references change every commit,
  // but stringify only reruns when the references actually change (selectAll
  // is memoized by the entity adapter, viewport is the slice object).
  const serialized = useMemo(
    () =>
      JSON.stringify({
        sketchesData: shapes,
        viewportData: { scale: viewport.scale, translate: viewport.translate },
      } satisfies AutosaveSnapshot),
    [shapes, viewport]
  );

  const lastSavedRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Latest serialized payload, readable from stable callbacks (retry).
  const serializedRef = useRef(serialized);
  serializedRef.current = serialized;

  // Initialize the baseline from just-loaded server data so the load itself
  // doesn't count as a change worth saving.
  const markLoaded = useCallback((snapshot: AutosaveSnapshot) => {
    lastSavedRef.current = JSON.stringify(snapshot);
  }, []);

  const performSave = useCallback(async () => {
    const payload = serializedRef.current;
    if (payload === lastSavedRef.current) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("saving");
    try {
      const { sketchesData, viewportData }: AutosaveSnapshot =
        JSON.parse(payload);
      const res = await fetch("/api/project", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sketchesData, viewportData }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Autosave failed: ${res.status}`);

      lastSavedRef.current = payload;
      setStatus("saved");
      if (savedResetRef.current) clearTimeout(savedResetRef.current);
      savedResetRef.current = setTimeout(() => {
        // saved → idle after ~2s (only if nothing else started meanwhile)
        setStatus((s) => (s === "saved" ? "idle" : s));
      }, SAVED_RESET_MS);
    } catch (error) {
      // An abort means a newer save superseded this one — not an error.
      if (controller.signal.aborted) return;
      console.error("Autosave error:", error);
      setStatus("error");
    }
  }, [projectId]);

  // Debounced watcher: any shapes/viewport change (re)arms a 1s timer.
  useEffect(() => {
    if (!enabled) return;
    if (serialized === lastSavedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void performSave();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [serialized, enabled, performSave]);

  // Cleanup on unmount / project switch.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedResetRef.current) clearTimeout(savedResetRef.current);
    };
  }, [projectId]);

  // Manual retry for the error state (status indicator click).
  const retry = useCallback(() => {
    void performSave();
  }, [performSave]);

  return { status, retry, markLoaded };
}

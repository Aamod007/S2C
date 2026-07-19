"use client";

import { Cloud, CloudAlert, CloudCheck, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AutosaveStatus } from "@/hooks/use-autosave";

// Small autosave-status indicator (spec §9): cloud icon + label, driven by
// the useAutosave hook running in the project provider. Error state is
// clickable to retry the failed save.
export function AutosaveIndicator({
  status,
  onRetry,
}: {
  status: AutosaveStatus;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        title="Autosave failed — click to retry"
      >
        <CloudAlert className="h-3.5 w-3.5" />
        Save failed — retry
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground transition-opacity",
        status === "idle" && "opacity-60"
      )}
      aria-live="polite"
    >
      {status === "saving" ? (
        <>
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </>
      ) : status === "saved" ? (
        <>
          <CloudCheck className="h-3.5 w-3.5" />
          Saved
        </>
      ) : (
        <Cloud className="h-3.5 w-3.5" />
      )}
    </div>
  );
}

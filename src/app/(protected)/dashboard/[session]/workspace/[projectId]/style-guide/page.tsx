"use client";

import { useParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MoodBoard } from "@/components/style/mood-board";
import { StyleGuideEmptyState, StyleGuideView } from "@/components/style/theme";
import { useMoodBoard, useStyleGuide } from "@/hooks/use-styles";

export default function StyleGuidePage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { styleGuide, generate, isGenerating, isLoading } =
    useStyleGuide(projectId);
  const moodBoard = useMoodBoard(projectId);

  const canGenerate =
    !isGenerating && (moodBoard.images?.length ?? 0) >= 1;

  return (
    <div className="h-full overflow-y-auto bg-zinc-950/50">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Style Guide
            </h1>
            <p className="text-sm text-muted-foreground">
              Define the visual language AI uses when generating your designs
            </p>
          </div>
          <Button onClick={generate} disabled={!canGenerate}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {styleGuide ? "Regenerate with AI" : "Generate with AI"}
              </>
            )}
          </Button>
        </div>

        <MoodBoard projectId={projectId} />

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          </div>
        ) : styleGuide ? (
          <StyleGuideView styleGuide={styleGuide} />
        ) : (
          <StyleGuideEmptyState />
        )}
      </div>
    </div>
  );
}

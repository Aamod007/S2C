"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useMoodBoard } from "@/hooks/use-styles";
import { ImageDropzone, ImageGrid } from "./image-dropzone";

interface MoodBoardProps {
  projectId: string;
}

/** Mood board section: dropzone + image grid (max 6, spec §10). */
export function MoodBoard({ projectId }: MoodBoardProps) {
  const { images, pending, upload, remove, isLoading, count, maxImages, isFull } =
    useMoodBoard(projectId);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Mood Board</h2>
          <p className="text-xs text-muted-foreground">
            Images that capture the vibe you&apos;re going for
          </p>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {count}/{maxImages}
        </span>
      </div>

      <ImageDropzone
        onFiles={upload}
        disabled={isFull}
        hint={
          isFull
            ? "Mood board is full"
            : "Drop images here, or click to browse"
        }
        subHint={isFull ? "Remove an image to add another" : `Up to ${maxImages} images`}
      />

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : (
        count > 0 && (
          <ImageGrid
            images={images}
            pending={pending}
            onRemove={remove}
            altPrefix="Mood board image"
          />
        )
      )}
    </section>
  );
}

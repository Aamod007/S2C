"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInspiration } from "@/hooks/use-styles";
import { ImageDropzone, ImageTile } from "@/components/style/mood-board/image-dropzone";

interface InspirationSidebarProps {
  projectId: string;
  className?: string;
}

/**
 * Compact vertical inspiration image strip (max 5, spec §10) for the canvas
 * sidebar. Self-contained — the canvas page imports and positions it:
 *
 *   <InspirationSidebar projectId={projectId} />
 */
export function InspirationSidebar({ projectId, className }: InspirationSidebarProps) {
  const { images, pending, upload, remove, isLoading, count, maxImages, isFull } =
    useInspiration(projectId);

  return (
    <aside
      className={
        "flex h-full w-40 flex-col border-l border-border/40 bg-background/95 " +
        (className ?? "")
      }
    >
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <h2 className="text-xs font-semibold text-foreground">Inspiration</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {count}/{maxImages}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))
          ) : (
            <>
              {images?.map((img, i) => (
                <ImageTile
                  key={img.storageId}
                  url={img.url}
                  alt={`Inspiration image ${i + 1}`}
                  onRemove={() => remove(img.storageId)}
                />
              ))}
              {pending.map((p) => (
                <ImageTile
                  key={p.id}
                  url={p.previewUrl}
                  alt="Inspiration image (uploading)"
                  isUploading
                />
              ))}
            </>
          )}

          <ImageDropzone
            onFiles={upload}
            disabled={isFull}
            hint={isFull ? "Full" : "Add image"}
            className="gap-1 p-3 [&_p]:text-xs"
          />
        </div>
      </ScrollArea>
    </aside>
  );
}

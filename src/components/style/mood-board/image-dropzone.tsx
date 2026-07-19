"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingImage, ProjectImage } from "@/hooks/use-styles";

interface ImageDropzoneProps {
  onFiles: (files: FileList | File[]) => void;
  disabled?: boolean;
  /** e.g. "Drop mood board images here". */
  hint: string;
  subHint?: string;
  className?: string;
}

/**
 * From-scratch drag-and-drop upload target (spec §10 — no library).
 * Uses a depth counter so dragging over child elements doesn't flicker
 * the highlight off (dragleave fires on every child boundary).
 */
export function ImageDropzone({
  onFiles,
  disabled,
  hint,
  subHint,
  className,
}: ImageDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current += 1;
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Required — without preventDefault the browser won't allow the drop.
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragOver(false);
      if (disabled) return;
      if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
    },
    [disabled, onFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
      // Reset so re-selecting the same file fires change again.
      e.target.value = "";
    },
    [onFiles]
  );

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border/60 bg-muted/20 p-6 text-center transition-colors",
        "hover:border-border hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragOver && "border-primary bg-primary/10",
        disabled && "cursor-not-allowed opacity-50 hover:border-border/60 hover:bg-muted/20",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
      <ImagePlus className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{hint}</p>
      {subHint && <p className="text-xs text-muted-foreground">{subHint}</p>}
    </button>
  );
}

interface ImageTileProps {
  url: string;
  alt: string;
  onRemove?: () => void;
  isUploading?: boolean;
  className?: string;
}

/**
 * A single image tile: server image or blob: preview with an uploading
 * overlay, plus a hover delete button.
 */
export function ImageTile({
  url,
  alt,
  onRemove,
  isUploading,
  className,
}: ImageTileProps) {
  return (
    <div
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border border-border/50 bg-muted/30",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Convex storage + blob: URLs aren't compatible with next/image */}
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        draggable={false}
      />
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {onRemove && !isUploading && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${alt}`}
          className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1 opacity-0 backdrop-blur-sm transition-opacity hover:bg-destructive hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface ImageGridProps {
  images: ProjectImage[] | undefined;
  pending: PendingImage[];
  onRemove: (storageId: string) => void;
  altPrefix: string;
  className?: string;
}

/** Grid of persisted images followed by in-flight blob previews. */
export function ImageGrid({
  images,
  pending,
  onRemove,
  altPrefix,
  className,
}: ImageGridProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-3 sm:grid-cols-6", className)}>
      {images?.map((img, i) => (
        <ImageTile
          key={img.storageId}
          url={img.url}
          alt={`${altPrefix} ${i + 1}`}
          onRemove={() => onRemove(img.storageId)}
        />
      ))}
      {pending.map((p) => (
        <ImageTile
          key={p.id}
          url={p.previewUrl}
          alt={`${altPrefix} (uploading)`}
          isUploading
        />
      ))}
    </div>
  );
}

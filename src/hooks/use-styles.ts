"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toast } from "sonner";
import { useGenerateStyleGuideMutation } from "@/redux/api/style-guide";
import type { StyleGuide } from "@/types/style-guide";

/** An image already persisted in Convex storage. */
export interface ProjectImage {
  storageId: string;
  url: string;
}

/** A locally-selected image still uploading — previewed via a blob: URL. */
export interface PendingImage {
  id: string;
  previewUrl: string;
  /** Set once addImage succeeds; used to detect when the live query catches up. */
  storageId?: string;
}

interface ImageCollectionOptions {
  projectId: string;
  /** Human label for toasts, e.g. "mood board". */
  label: string;
  maxImages: number;
  images: ProjectImage[] | undefined;
  generateUploadUrl: () => Promise<string>;
  addImage: (args: {
    projectId: Id<"projects">;
    storageId: string;
  }) => Promise<unknown>;
  removeImage: (args: {
    projectId: Id<"projects">;
    storageId: string;
  }) => Promise<unknown>;
}

/**
 * Shared upload/remove logic for mood board + inspiration images.
 *
 * Optimistic flow: a blob: preview is shown immediately; once the upload +
 * addImage mutation land, the live getImageUrls query re-fires with the new
 * storageId, at which point the matching pending entry is dropped and its
 * blob URL revoked — the grid swaps seamlessly to the server URL.
 */
function useImageCollection({
  projectId,
  label,
  maxImages,
  images,
  generateUploadUrl,
  addImage,
  removeImage,
}: ImageCollectionOptions) {
  const [pending, setPending] = useState<PendingImage[]>([]);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  // Swap: once the server list contains a pending image's storageId, retire
  // the blob preview.
  useEffect(() => {
    if (!images) return;
    const settled = pendingRef.current.filter(
      (p) => p.storageId && images.some((img) => img.storageId === p.storageId)
    );
    if (settled.length === 0) return;
    settled.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending((prev) => prev.filter((p) => !settled.some((s) => s.id === p.id)));
  }, [images]);

  // Revoke any outstanding blob URLs on unmount.
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const uploadOne = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setPending((prev) => [...prev, { id, previewUrl }]);

      try {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const { storageId } = (await res.json()) as { storageId: string };

        await addImage({
          projectId: projectId as Id<"projects">,
          storageId,
        });

        // Keep the blob preview alive until the live query includes this
        // storageId (handled by the swap effect above).
        setPending((prev) =>
          prev.map((p) => (p.id === id ? { ...p, storageId } : p))
        );
      } catch (error) {
        URL.revokeObjectURL(previewUrl);
        setPending((prev) => prev.filter((p) => p.id !== id));
        toast.error(
          error instanceof Error && error.message.includes("Maximum")
            ? error.message
            : `Failed to upload ${label} image`
        );
      }
    },
    [projectId, label, generateUploadUrl, addImage]
  );

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (imageFiles.length === 0) {
        toast.error("Only image files are supported");
        return;
      }

      const used = (images?.length ?? 0) + pendingRef.current.length;
      const slots = maxImages - used;
      if (slots <= 0) {
        toast.error(`Maximum of ${maxImages} ${label} images allowed`);
        return;
      }
      if (imageFiles.length > slots) {
        toast.warning(
          `Only ${slots} more ${label} image${slots === 1 ? "" : "s"} allowed — extra files were skipped`
        );
      }

      await Promise.all(imageFiles.slice(0, slots).map(uploadOne));
    },
    [images, maxImages, label, uploadOne]
  );

  const remove = useCallback(
    async (storageId: string) => {
      try {
        await removeImage({
          projectId: projectId as Id<"projects">,
          storageId,
        });
      } catch {
        toast.error(`Failed to remove ${label} image`);
      }
    },
    [projectId, label, removeImage]
  );

  const count = (images?.length ?? 0) + pending.length;

  return {
    /** Persisted images (undefined while the query loads). */
    images,
    /** In-flight uploads with blob: previews. */
    pending,
    upload,
    remove,
    isUploading: pending.length > 0,
    isLoading: images === undefined,
    count,
    maxImages,
    isFull: count >= maxImages,
  };
}

function nonNull<T>(value: T | null): value is T {
  return value !== null;
}

/** Mood board images — max 6, shown on the style guide page. */
export function useMoodBoard(projectId: string) {
  const raw = useQuery(api.moodboard.getImageUrls, {
    projectId: projectId as Id<"projects">,
  });
  const images = useMemo(() => raw?.filter(nonNull), [raw]);

  const generateUploadUrl = useMutation(api.moodboard.generateUploadUrl);
  const addImage = useMutation(api.moodboard.addImage);
  const removeImage = useMutation(api.moodboard.removeImage);

  return useImageCollection({
    projectId,
    label: "mood board",
    maxImages: 6,
    images,
    generateUploadUrl,
    addImage,
    removeImage,
  });
}

/** Inspiration images — max 5, shown in the canvas sidebar. */
export function useInspiration(projectId: string) {
  const raw = useQuery(api.inspiration.getImageUrls, {
    projectId: projectId as Id<"projects">,
  });
  const images = useMemo(() => raw?.filter(nonNull), [raw]);

  // convex/inspiration.ts has no generateUploadUrl of its own — upload URLs
  // are project-agnostic (auth-checked only), so we reuse moodboard's.
  const generateUploadUrl = useMutation(api.moodboard.generateUploadUrl);
  const addImage = useMutation(api.inspiration.addImage);
  const removeImage = useMutation(api.inspiration.removeImage);

  return useImageCollection({
    projectId,
    label: "inspiration",
    maxImages: 5,
    images,
    generateUploadUrl,
    addImage,
    removeImage,
  });
}

/**
 * Style guide state: reads the persisted guide from projects.getById (live —
 * updates when /api/generate/style saves it server-side) and exposes the
 * generate mutation.
 */
export function useStyleGuide(projectId: string) {
  const project = useQuery(api.projects.getById, {
    projectId: projectId as Id<"projects">,
  });
  const [generateStyleGuide, { isLoading: isGenerating }] =
    useGenerateStyleGuideMutation();

  const generate = useCallback(async () => {
    try {
      await generateStyleGuide({ projectId }).unwrap();
      toast.success("Style guide generated");
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? (error as { status: unknown }).status
          : undefined;
      if (status === 402) {
        toast.error("You're out of credits — upgrade your plan to generate.");
      } else {
        toast.error("Failed to generate style guide. Please try again.");
      }
    }
  }, [projectId, generateStyleGuide]);

  return {
    styleGuide: (project?.style_guide ?? null) as StyleGuide | null,
    generate,
    isGenerating,
    /** undefined while loading, null if not found/unauthorized. */
    project,
    isLoading: project === undefined,
  };
}

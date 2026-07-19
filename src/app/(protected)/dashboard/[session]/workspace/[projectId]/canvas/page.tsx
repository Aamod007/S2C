"use client";

import { useParams } from "next/navigation";
import { CanvasContainer } from "@/components/canvas";

export default function CanvasPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <div className="flex h-full w-full">
      <CanvasContainer projectId={projectId} />
    </div>
  );
}

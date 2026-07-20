"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { LayoutDashboard, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ProjectProvider,
  AutosaveStatusBadge,
} from "@/components/projects/provider";

const TABS = [
  { label: "Canvas", segment: "canvas", icon: LayoutDashboard },
  { label: "Style Guide", segment: "style-guide", icon: Palette },
] as const;

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const session = params.session as string;
  const projectId = params.projectId as string;
  const base = `/dashboard/${session}/workspace/${projectId}`;

  return (
    <ProjectProvider key={projectId} projectId={projectId}>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
          {/* Secondary navbar removed as per user request */}
          <div className="absolute top-2 right-4 z-50 pointer-events-auto">
            <AutosaveStatusBadge />
          </div>
        <div className="relative flex-1 overflow-hidden">{children}</div>
      </div>
    </ProjectProvider>
  );
}

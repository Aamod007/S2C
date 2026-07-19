"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { LayoutDashboard, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <nav className="flex shrink-0 items-center gap-1 border-b border-border/40 bg-background/95 px-4">
        {TABS.map(({ label, segment, icon: Icon }) => {
          const href = `${base}/${segment}`;
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={segment}
              href={href}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="relative flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

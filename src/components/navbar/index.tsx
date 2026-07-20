"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { generateUserSlug } from "@/lib/slugify";
import { useAppSelector } from "@/redux/hooks";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard } from "lucide-react";
import { useProject } from "@/hooks/use-project";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  const router = useRouter();
  // Server-preloaded profile (root layout preloadedState, spec §5) renders
  // immediately; the live Convex query takes over once it resolves.
  const preloadedProfile = useAppSelector((state) => state.profile.user);
  const liveUser = useQuery(api.users.currentUser);
  const user = liveUser ?? preloadedProfile;
  const credits = useQuery(api.subscriptions.getCreditBalance) ?? 0;

  const { createProject, isCreating } = useProject();

  const handleCreateProject = async () => {
    try {
      const projectId = await createProject({ name: "Untitled Project" });
      if (projectId && user) {
        const session = generateUserSlug(user.name, user.email);
        router.push(`/dashboard/${session}/workspace/${projectId}/canvas`);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  if (!user) return null;

  const session = generateUserSlug(user.name, user.email);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4">
        <div className="mr-4 flex">
          <Link href={`/dashboard/${session}`} className="mr-6 flex items-center space-x-2">
            <span className="font-bold sm:inline-block">S2C</span>
          </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          <div className="flex items-center space-x-2">
            <div className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-3 py-1.5 text-sm font-medium">
              <CreditCard className="h-4 w-4 text-primary" />
              <span>{credits} credits</span>
            </div>
            
            <Button 
              size="sm" 
              onClick={handleCreateProject} 
              disabled={isCreating}
              className="hidden sm:flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>

          <ThemeToggle />
          <UserButton />
        </div>
      </div>
    </header>
  );
}

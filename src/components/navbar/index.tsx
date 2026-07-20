"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { generateUserSlug } from "@/lib/slugify";
import { useAppSelector } from "@/redux/hooks";
import { Button } from "@/components/ui/button";
import { Plus, HelpCircle, Hash, Palette, Loader2 } from "lucide-react";
import { useProject } from "@/hooks/use-project";

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
    <header className="sticky top-0 z-50 w-full border-b border-neutral-900 bg-neutral-950">
      <div className="flex h-16 w-full items-center justify-between px-6">
        
        {/* Left: Logo */}
        <Link href={`/dashboard/${session}`} className="flex items-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-[2.5px] border-white">
            <div className="h-2 w-2 rounded-full bg-white" />
          </div>
        </Link>
        
        {/* Center: Tabs */}
        <div className="flex items-center space-x-1 rounded-full bg-neutral-900 p-1">
          <button className="flex items-center space-x-2 rounded-full px-4 py-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors">
            <Hash className="h-4 w-4" />
            <span>Canvas</span>
          </button>
          <button className="flex items-center space-x-2 rounded-full px-4 py-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors">
            <Palette className="h-4 w-4" />
            <span>Style Guide</span>
          </button>
        </div>
        
        {/* Right: Actions & User */}
        <div className="flex items-center space-x-4">
          <span className="text-xs font-medium text-neutral-500">
            {credits} credits
          </span>
          
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-neutral-400 hover:text-neutral-200 transition-colors">
            <HelpCircle className="h-4 w-4" />
          </button>

          <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden">
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </div>

          <Button 
            onClick={handleCreateProject} 
            disabled={isCreating}
            className="hidden sm:flex h-8 rounded-full bg-white px-4 text-sm font-medium text-black hover:bg-neutral-200"
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4 text-neutral-600" />
            )}
            New Project
          </Button>
        </div>

      </div>
    </header>
  );
}

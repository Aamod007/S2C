"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { generateUserSlug } from "@/lib/slugify";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, LogOut, Plus, Settings, CreditCard } from "lucide-react";
import { useProject } from "@/hooks/use-project";

export function Navbar() {
  const { signOut } = useAuth();
  const router = useRouter();
  const user = useQuery(api.users.currentUser);
  const credits = useQuery(api.subscriptions.getCreditBalance) ?? 0;
  
  // We'll build useProject next
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

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.image} alt={user.name ?? "User"} />
                  <AvatarFallback>{user.name?.charAt(0) ?? "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/${session}`}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

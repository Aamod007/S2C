"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useProject } from "@/hooks/use-project";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Plus, Layout, MoreVertical, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useParams, useRouter } from "next/navigation";

export default function ProjectListPage() {
  const params = useParams();
  const session = params.session as string;
  const router = useRouter();
  
  const projects = useQuery(api.projects.listByUser);
  const { createProject, deleteProject, isCreating } = useProject();

  const handleCreateProject = async () => {
    try {
      const projectId = await createProject({ name: "Untitled Project" });
      if (projectId) {
        router.push(`/dashboard/${session}/workspace/${projectId}/canvas`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteProject(projectId);
    } catch (error) {
      console.error(error);
    }
  };

  if (projects === undefined) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-screen-2xl p-6 md:p-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your sketches, mood boards, and generated code.
          </p>
        </div>
        <Button onClick={handleCreateProject} disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Layout className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="mt-6 text-xl font-semibold">No projects created</h2>
            <p className="mb-8 mt-2 text-center text-sm font-normal leading-6 text-muted-foreground">
              You don&apos;t have any projects yet. Create one to start sketching and generating code.
            </p>
            <Button onClick={handleCreateProject} disabled={isCreating} size="lg">
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create your first project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <Link
              key={project._id}
              href={`/dashboard/${session}/workspace/${project._id}/canvas`}
            >
              <Card className="group flex h-full flex-col overflow-hidden transition-all hover:border-primary/50 hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="line-clamp-1 text-base">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">
                      {project.description || "No description"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100"
                      >
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                        onClick={(e) => handleDeleteProject(project._id, e)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="flex-1">
                  {/* Thumbnail placeholder - could render a mini canvas preview here in the future */}
                  <div className="mt-2 flex h-32 w-full items-center justify-center rounded-md border border-dashed bg-muted/50">
                    <Layout className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
                <CardFooter className="border-t bg-muted/20 px-6 py-3">
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDistanceToNow(project.last_modified, { addSuffix: true })}
                  </p>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

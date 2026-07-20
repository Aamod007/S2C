"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useProject } from "@/hooks/use-project";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Plus, Layout, MoreVertical, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
const GRADIENTS = [
  "bg-gradient-to-br from-pink-400 to-rose-300",
  "bg-gradient-to-br from-emerald-400 to-teal-300",
  "bg-gradient-to-br from-blue-400 to-cyan-300",
  "bg-gradient-to-br from-slate-200 to-slate-300",
  "bg-gradient-to-br from-green-400 to-emerald-300",
];
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
  
    const rawProjects = useQuery(api.projects.listByUser);
  const projects = rawProjects && rawProjects.length > 0 ? rawProjects : [
    { _id: '1', name: 'Project Alpha', last_modified: Date.now() },
    { _id: '2', name: 'Design System', last_modified: Date.now() - 100000 },
    { _id: '3', name: 'Landing Page', last_modified: Date.now() - 200000 },
    { _id: '4', name: 'Mobile App', last_modified: Date.now() - 300000 },
    { _id: '5', name: 'Dashboard Layout', last_modified: Date.now() - 400000 },
  ];
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

  if (false) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-screen-2xl p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Your Projects</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Manage your design projects and continue where you left off.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 p-8 text-center animate-in fade-in-50">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-900">
              <Layout className="h-10 w-10 text-neutral-500" />
            </div>
            <h2 className="mt-6 text-xl font-medium text-white">No projects created</h2>
            <p className="mb-8 mt-2 text-center text-sm font-normal leading-6 text-neutral-400">
              You don&apos;t have any projects yet. Create one to start sketching and generating code.
            </p>
            <Button onClick={handleCreateProject} disabled={isCreating} size="lg" className="bg-white text-black hover:bg-neutral-200">
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
        <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {projects.map((project, index) => {
            const gradient = GRADIENTS[index % GRADIENTS.length];
            return (
              <Link
                key={project._id}
                href={`/dashboard/${session}/workspace/${project._id}/canvas`}
                className="group flex flex-col cursor-pointer"
              >
                <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl ${gradient} transition-transform duration-200 group-hover:scale-[1.02] flex items-center justify-center shadow-lg`}>
                  
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm">
                    <div className="h-5 w-5 rounded-full bg-white shadow-sm" />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                      <Button
                        variant="ghost"
                        className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/10 p-0 text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-black/20 group-hover:opacity-100"
                      >
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-neutral-800 bg-neutral-950 text-neutral-200">
                      <DropdownMenuItem
                        className="text-red-400 focus:bg-red-950 focus:text-red-400"
                        onClick={(e) => handleDeleteProject(project._id, e)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="mt-3 px-1">
                  <h3 className="text-sm font-medium text-white line-clamp-1">{project.name}</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    {formatDistanceToNow(project.last_modified, { addSuffix: true })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  createStart,
  createSuccess,
  createFailure,
  removeProject,
  addProject,
} from "@/redux/slices/projects";
import { toast } from "sonner";
import { useCallback } from "react";

export function useProject() {
  const dispatch = useAppDispatch();
  const createMutation = useMutation(api.projects.create);
  const deleteMutation = useMutation(api.projects.remove);

  const isCreating = useAppSelector((state) => state.projects.isCreating);
  const projects = useAppSelector((state) => state.projects.projects);

  const createProject = useCallback(
    async (params: { name: string; description?: string }) => {
      dispatch(createStart());

      try {
        // The mutation returns the inserted doc — mirror the REAL fields
        // into Redux (no fabricated project_number/timestamps).
        const project = await createMutation(params);
        if (!project) throw new Error("Create returned no project");

        dispatch(
          createSuccess({
            _id: project._id,
            name: project.name,
            description: project.description,
            project_number: project.project_number,
            last_modified: project.last_modified,
            created_at: project.created_at,
          })
        );

        toast.success("Project created successfully");
        return project._id;
      } catch (error) {
        dispatch(
          createFailure(
            error instanceof Error ? error.message : "Failed to create project"
          )
        );
        toast.error("Failed to create project");
        throw error;
      }
    },
    [createMutation, dispatch]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      // Optimistic delete — keep the removed doc so a failed mutation can
      // restore it instead of leaving Redux out of sync with Convex.
      const previous = projects.find((p) => p._id === projectId);
      dispatch(removeProject(projectId));

      try {
        await deleteMutation({ projectId: projectId as Id<"projects"> });
        toast.success("Project deleted");
      } catch (error) {
        if (previous) dispatch(addProject(previous));
        toast.error("Failed to delete project");
        throw error;
      }
    },
    [deleteMutation, dispatch, projects]
  );

  return {
    createProject,
    deleteProject,
    isCreating,
  };
}

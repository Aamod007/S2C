"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  createStart,
  createSuccess,
  createFailure,
  removeProject,
} from "@/redux/slices/projects";
import { toast } from "sonner";
import { useCallback } from "react";

export function useProject() {
  const dispatch = useAppDispatch();
  const createMutation = useMutation(api.projects.create);
  const deleteMutation = useMutation(api.projects.remove);
  
  const isCreating = useAppSelector((state) => state.projects.isCreating);

  const createProject = useCallback(
    async (params: { name: string; description?: string }) => {
      dispatch(createStart());
      
      try {
        const projectId = await createMutation(params);
        
        // Optimistic UI handled via Redux if needed, but since we get the ID back, 
        // we can just add the real project. We don't have all the details immediately,
        // but it will be refetched by the list query anyway.
        dispatch(
          createSuccess({
            _id: projectId,
            name: params.name,
            description: params.description,
            project_number: Date.now(), // Temp
            last_modified: Date.now(),
            created_at: Date.now(),
          })
        );
        
        toast.success("Project created successfully");
        return projectId;
      } catch (error) {
        dispatch(createFailure(error instanceof Error ? error.message : "Failed to create project"));
        toast.error("Failed to create project");
        throw error;
      }
    },
    [createMutation, dispatch]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      // Optimistic delete
      dispatch(removeProject(projectId));
      
      try {
        await deleteMutation({ projectId: projectId as any });
        toast.success("Project deleted");
      } catch (error) {
        // Rollback on failure (simplified, in a real app we'd save the previous state)
        toast.error("Failed to delete project");
        throw error;
      }
    },
    [deleteMutation, dispatch]
  );

  return {
    createProject,
    deleteProject,
    isCreating,
  };
}

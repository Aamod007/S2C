import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Project {
  _id: string;
  name: string;
  description?: string;
  project_number: number;
  last_modified: number;
  created_at: number;
}

interface ProjectsState {
  projects: Project[];
  total: number;
  isLoading: boolean;
  error: string | null;
  isCreating: boolean;
  createError: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  total: 0,
  isLoading: false,
  error: null,
  isCreating: false,
  createError: null,
};

const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    fetchStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchSuccess: (
      state,
      action: PayloadAction<{ projects: Project[]; total: number }>
    ) => {
      state.isLoading = false;
      state.projects = action.payload.projects;
      state.total = action.payload.total;
    },
    fetchFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    createStart: (state) => {
      state.isCreating = true;
      state.createError = null;
    },
    createSuccess: (state, action: PayloadAction<Project>) => {
      state.isCreating = false;
      state.projects.unshift(action.payload);
      state.total += 1;
    },
    createFailure: (state, action: PayloadAction<string>) => {
      state.isCreating = false;
      state.createError = action.payload;
    },
    addProject: (state, action: PayloadAction<Project>) => {
      state.projects.unshift(action.payload);
      state.total += 1;
    },
    // Insert-or-update a single project (e.g. mirrored from a Convex getById
    // result in the workspace) without touching the rest of the list.
    upsertProject: (state, action: PayloadAction<Project>) => {
      const index = state.projects.findIndex(
        (p) => p._id === action.payload._id
      );
      if (index === -1) {
        state.projects.unshift(action.payload);
        state.total += 1;
      } else {
        state.projects[index] = action.payload;
      }
    },
    updateProject: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Project> }>
    ) => {
      const index = state.projects.findIndex(
        (p) => p._id === action.payload.id
      );
      if (index !== -1) {
        state.projects[index] = {
          ...state.projects[index],
          ...action.payload.updates,
        };
      }
    },
    removeProject: (state, action: PayloadAction<string>) => {
      const index = state.projects.findIndex(
        (p) => p._id === action.payload
      );
      // Only decrement when the id was actually present — deletes of
      // projects never loaded into Redux must not drive total negative.
      if (index !== -1) {
        state.projects.splice(index, 1);
        state.total -= 1;
      }
    },
    clearProjects: (state) => {
      state.projects = [];
      state.total = 0;
    },
  },
});

export const {
  fetchStart,
  fetchSuccess,
  fetchFailure,
  createStart,
  createSuccess,
  createFailure,
  addProject,
  upsertProject,
  updateProject,
  removeProject,
  clearProjects,
} = projectsSlice.actions;
export default projectsSlice.reducer;

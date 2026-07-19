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
      state.projects = state.projects.filter(
        (p) => p._id !== action.payload
      );
      state.total -= 1;
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
  updateProject,
  removeProject,
  clearProjects,
} = projectsSlice.actions;
export default projectsSlice.reducer;

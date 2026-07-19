import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const projectApi = createApi({
  reducerPath: "projectApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    // Matches PATCH /api/project (src/app/api/project/route.ts): camelCase
    // keys, no userId — the route authenticates via Clerk and resolves the
    // Convex user itself. Returns { status: "queued" } once the Inngest
    // autosave job is enqueued.
    autosaveProject: builder.mutation<
      { status: string },
      {
        projectId: string;
        sketchesData: unknown;
        viewportData?: unknown;
      }
    >({
      query: (body) => ({
        url: "/project",
        method: "PATCH",
        body,
      }),
    }),
  }),
});

export const { useAutosaveProjectMutation } = projectApi;

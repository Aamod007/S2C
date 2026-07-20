import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const projectApi = createApi({
  reducerPath: "projectApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    // Matches PATCH /api/project (src/app/api/project/route.ts): camelCase
    // keys, no userId — the route authenticates via Clerk and resolves the
    // Convex user itself. Returns { status: "queued" } once the Inngest
    // autosave job is enqueued.
    // NOTE: currently unused — the live autosave client is raw fetch in
    // src/hooks/use-autosave.ts (needs AbortController supersede + keepalive
    // flush semantics RTK Query doesn't offer). Kept in sync with the route
    // contract for future non-streaming callers.
    autosaveProject: builder.mutation<
      { status: string },
      {
        projectId: string;
        sketchesData: unknown;
        viewportData?: unknown;
        /** Client-side snapshot timestamp for the staleness guard. */
        savedAt?: number;
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

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const projectApi = createApi({
  reducerPath: "projectApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    autosaveProject: builder.mutation<
      void,
      {
        projectId: string;
        sketches_data: any;
        viewport_data?: any;
        userId: string;
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

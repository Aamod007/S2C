import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const generationApi = createApi({
  reducerPath: "generationApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    generate: builder.mutation<unknown, FormData>({
      query: (body) => ({
        url: "/generate",
        method: "POST",
        body,
      }),
    }),
    redesign: builder.mutation<
      unknown,
      { shapeId: string; message: string; html: string; projectId: string }
    >({
      query: (body) => ({
        url: "/generate/redesign",
        method: "POST",
        body,
      }),
    }),
    generateWorkflow: builder.mutation<
      unknown,
      { frameId: string; projectId: string }
    >({
      query: (body) => ({
        url: "/generate/workflow",
        method: "POST",
        body,
      }),
    }),
    redesignWorkflow: builder.mutation<
      unknown,
      { shapeId: string; message: string; html: string; projectId: string }
    >({
      query: (body) => ({
        url: "/generate/workflow-redesign",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useGenerateMutation,
  useRedesignMutation,
  useGenerateWorkflowMutation,
  useRedesignWorkflowMutation,
} = generationApi;

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const styleGuideApi = createApi({
  reducerPath: "styleGuideApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    generateStyleGuide: builder.mutation<unknown, { projectId: string }>({
      query: (body) => ({
        url: "/generate/style",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const { useGenerateStyleGuideMutation } = styleGuideApi;

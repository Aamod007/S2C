import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const billingApi = createApi({
  reducerPath: "billingApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    getCheckout: builder.query<{ url: string }, { userId: string }>({
      query: ({ userId }) => `/billing/checkout?userId=${userId}`,
    }),
  }),
});

export const { useLazyGetCheckoutQuery } = billingApi;

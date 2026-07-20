import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const billingApi = createApi({
  reducerPath: "billingApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  endpoints: (builder) => ({
    // Matches GET /api/billing/checkout (src/app/api/billing/checkout/route.ts):
    // no params — the route resolves the user from the Clerk session itself
    // (never trust a client-supplied userId). Returns the Polar checkout URL.
    getCheckout: builder.query<{ url: string }, void>({
      query: () => "/billing/checkout",
    }),
  }),
});

export const { useLazyGetCheckoutQuery } = billingApi;

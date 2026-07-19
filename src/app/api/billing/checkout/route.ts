import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Polar } from "@polar-sh/sdk";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";

// GET /api/billing/checkout — create a Polar checkout session for the
// signed-in user and return its URL for the client to redirect to (spec §8.1).
export async function GET() {
  try {
    const { userId: clerkUserId, getToken } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    const productId = process.env.POLAR_STANDARD_PRODUCT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!accessToken || !productId || !appUrl) {
      console.error("Billing checkout: missing Polar env vars");
      return NextResponse.json(
        { error: "Billing is not configured" },
        { status: 500 }
      );
    }

    // Resolve our internal (Convex users-table) id using the caller's own
    // Convex-templated Clerk JWT. This id is what the webhook flow stores
    // subscriptions against, so it's what goes into checkout metadata.
    // Fail-soft: if the token/template or user row is unavailable, the
    // webhook's email-lookup fallback still resolves the user.
    let convexUserId: string | null = null;
    try {
      const token = (await getToken({ template: "convex" })) ?? undefined;
      if (token) {
        const convexUser = await fetchQuery(api.users.currentUser, {}, { token });
        convexUserId = convexUser?._id ?? null;
      }
    } catch (error) {
      console.warn("Billing checkout: could not resolve Convex user id", error);
    }

    const polar = new Polar({
      accessToken,
      // Default to sandbox — set POLAR_SERVER=production to go live.
      server:
        process.env.POLAR_SERVER === "production" ? "production" : "sandbox",
    });

    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: `${appUrl}/dashboard/billing/success`,
      // Copied onto the subscription by Polar — lets the webhook flow resolve
      // our internal user directly. If the Convex user row doesn't exist yet,
      // the webhook falls back to a normalized customer-email lookup.
      metadata: convexUserId ? { userId: convexUserId } : {},
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Billing checkout failed:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

import { redirect } from "next/navigation";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { getConvexToken } from "@/lib/preload";
import { generateUserSlug } from "@/lib/slugify";

/**
 * Dashboard routing gate (spec §4): resolves the user and checks subscription
 * entitlement SERVER-side, then redirects to the billing page (no
 * entitlement) or the session dashboard. No client-side gap to bypass.
 */
export default async function DashboardRootPage() {
  const token = await getConvexToken();
  // Middleware already forces auth on /dashboard — a missing token here
  // means the Clerk "convex" JWT template isn't configured. Fail loudly
  // rather than redirect-looping.
  if (!token) {
    throw new Error(
      'Could not mint a Convex token — is the Clerk "convex" JWT template configured?'
    );
  }

  let user = await fetchQuery(api.users.currentUser, {}, { token });
  if (!user) {
    // First request of a brand-new session — the client-side AuthSync
    // mutation may not have run yet. Sync the users row server-side.
    try {
      await fetchMutation(api.users.storeUser, {}, { token });
      user = await fetchQuery(api.users.currentUser, {}, { token });
    } catch (error) {
      console.error("[dashboard] storeUser sync failed:", error);
    }
  }

  const entitled = user
    ? await fetchQuery(api.subscriptions.isEntitled, {}, { token })
    : false;

  const slug = generateUserSlug(user?.name, user?.email);
  redirect(entitled ? `/dashboard/${slug}` : `/dashboard/billing/${slug}`);
}

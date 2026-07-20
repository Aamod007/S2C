import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import type {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
} from "convex/server";

/**
 * Server-side preload-query helpers (readme §11 lists these as
 * `convex/query.config.ts`, but everything under convex/ is bundled and
 * pushed to the Convex deployment by `npx convex dev`, and these helpers
 * need `@clerk/nextjs/server` — Next-only code — so they live here instead;
 * see DECISIONS.md).
 *
 * Used by server components (root-layout profile preload, dashboard
 * entitlement gates) to run authed Convex queries during render.
 */

/** Mints the caller's Convex-audience Clerk JWT, or undefined if signed out
 *  or the "convex" JWT template isn't configured. */
export async function getConvexToken(): Promise<string | undefined> {
  const { userId, getToken } = await auth();
  if (!userId) return undefined;
  try {
    return (await getToken({ template: "convex" })) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Runs an authed Convex query for the signed-in user. Fail-soft: returns
 * null when signed out, the token can't be minted, or the query throws —
 * callers must treat null as "unknown", NOT as a definitive query result
 * (e.g. don't lock a user out of the dashboard because a gate read null).
 */
export async function preloadAuthedQuery<
  Query extends FunctionReference<"query">,
>(
  query: Query,
  args: FunctionArgs<Query>
): Promise<FunctionReturnType<Query> | null> {
  const token = await getConvexToken();
  if (!token) return null;
  try {
    return await fetchQuery(query, args, { token });
  } catch (error) {
    console.error("[preload] authed query failed:", error);
    return null;
  }
}

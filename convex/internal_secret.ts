/**
 * Shared-secret gate for Convex functions that must run without a user
 * identity (Polar webhook → Inngest → Convex, autosave workflow).
 *
 * These functions used to be plain public mutations/queries — callable by
 * anyone who knew the deployment URL (it ships to the browser in
 * NEXT_PUBLIC_CONVEX_URL). They now require an `internalSecret` argument
 * matching the INTERNAL_FUNCTION_SECRET env var, which must be set in BOTH:
 *   - the Convex deployment:  npx convex env set INTERNAL_FUNCTION_SECRET <value>
 *   - the Next.js server env: INTERNAL_FUNCTION_SECRET=<value>
 *
 * Fails closed: if the env var is not configured, every gated call throws.
 */
export function requireInternalSecret(provided: string): void {
  const expected = process.env.INTERNAL_FUNCTION_SECRET;
  if (!expected) {
    throw new Error(
      "INTERNAL_FUNCTION_SECRET is not set on the Convex deployment — " +
        "run: npx convex env set INTERNAL_FUNCTION_SECRET <value>"
    );
  }
  if (provided !== expected) {
    throw new Error("Invalid internal secret");
  }
}

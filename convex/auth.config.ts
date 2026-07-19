/**
 * Convex auth config — tells Convex how to validate Clerk-issued JWTs.
 * Requires a JWT template named "convex" in the Clerk dashboard, and the
 * CLERK_JWT_ISSUER_DOMAIN env var set on the Convex deployment:
 *   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-clerk-subdomain>.clerk.accounts.dev
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};

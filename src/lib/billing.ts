/**
 * Billing constants shared between server workflows and UI. Kept out of
 * src/inngest/functions.ts so client components can import them without
 * pulling the Inngest/Convex server plumbing into the bundle.
 */

/**
 * Credits granted per billing period on the standard plan (spec §8.2 grants
 * credits on subscription create/renew; the amount itself is not specified
 * in the spec, so it lives here as a single documented constant).
 */
export const STANDARD_PLAN_CREDITS = 100;

/** Display name for the single Polar product tier (POLAR_STANDARD_PRODUCT_ID). */
export const STANDARD_PLAN_NAME = "Standard";

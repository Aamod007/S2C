# DECISIONS.md

Log of any deviations from the build spec (`readme.md`) made during implementation.
Paste this into every new phase's prompt so the AI stays consistent with the actual codebase.

---

## Phase 0 — Scaffold

- **Next.js version**: Used `create-next-app@15.4.6` as specified. npm warns of a security vulnerability (CVE-2025-66478) — will upgrade to a patched 15.4.x once available.
- **App created in subdirectory**: Scaffolded into `s2c-app/` instead of repo root because the parent directory name "Sketch" has a capital letter which npm rejects as a package name.
- **shadcn preset**: Used "Nova" preset (Lucide + Geist fonts) with Radix base and CSS variables. The spec says "neutral base color" — Nova defaults to neutral.
- **`next-themes`**: Already bundled as a dependency by shadcn. Used `forcedTheme="dark"` as specified.
- **TooltipProvider**: Added to root layout as required by shadcn's tooltip component.
- **Sonner Toaster**: Positioned `bottom-right` with `richColors` enabled.

---

## Foundation fixes (2026-07-19)

- **Auth: Clerk kept, Convex Auth dropped** (user decision, 2026-07-19). The spec (§4) calls for `@convex-dev/auth` with Google + Password providers; the codebase already uses `@clerk/nextjs` v7 and we are keeping it. Consequences:
  - `src/middleware.ts` uses `clerkMiddleware` + `createRouteMatcher` (Clerk v7 pattern) instead of `convexAuthNextjsMiddleware`. Public routes: `/`, `/sign-in`, `/sign-up`, plus `/api/billing/webhook` and `/api/inngest` (webhooks are provider-signed and can't authenticate via Clerk). All other routes call `auth.protect()`.
  - `convex/auth.ts` maps the Clerk identity (`identity.subject` → `users.clerkId` via the `by_clerk_id` index) to our users table.
  - Spec §12 env vars `CONVEX_SITE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` are replaced by `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` (see `.env.example`).
- **Login bypass shims removed** (2026-07-19):
  - `src/middleware.ts` previously had an empty `clerkMiddleware` handler (`// BYPASS LOGIN`) — now enforces auth as above.
  - `convex/auth.ts` `getAuthUserId` previously fell back to "first user in DB" or inserted a dummy user when unauthenticated — now returns `null` if there is no identity or no matching users row.
  - `src/lib/permissions.ts` (Convex-Auth-style route matchers, referenced nowhere) deleted; route matching lives in the Clerk middleware.
  - Stray compiled `.js` siblings of every `convex/*.ts` file (auth, inspiration, moodboard, projects, schema, subscriptions, users) deleted — they were build artifacts not used by `convex dev` and risked drifting from the `.ts` sources (e.g. `auth.js` still contained the login bypass).
- **tsconfig path alias `@convex/*`** added (→ `./convex/*`) so deep app-router pages don't need fragile `../../..` imports of `convex/_generated/api`.
- **Dependency versions newer than spec pins** (installed as of 2026-07-19; spec's pinned versions were older): `zod` ^4.4.3 (spec era: v3), `ai` ^7.0.31, `@ai-sdk/anthropic` ^4.0.16, `inngest` ^4.13.0, `@polar-sh/sdk` ^0.48.1, `@clerk/nextjs` ^7.5.20, `uuid` ^14.0.1, `convex` ^1.42.3, `@reduxjs/toolkit` ^2.8.2, `lucide-react` ^1.25.0, `recharts` ^3.8.0, `react-day-picker` ^10.0.1. Follow the installed majors' APIs, not spec-era ones (e.g. Clerk v7 removed `afterSignOutUrl` on `<UserButton>` — configure sign-out redirect via `<ClerkProvider>`/dashboard instead).

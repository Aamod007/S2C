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

---

## Generation frontend (phases 7/8/9/12) (2026-07-19)

- **RTK Query `generationApi` mutations not used for generation calls.** `fetchBaseQuery` buffers the whole response, which defeats token streaming. `useFrame`/`useChatWindow` call `fetch()` directly with `body.getReader()` + `TextDecoder` (spec §7.2.6). ~~The generationApi endpoints are left in place untouched.~~ *(Superseded — the slice was later removed entirely; see Seam-review fixes below.)*
- **`GeneratedUIShape` extended** (types owned by canvas work): `uiSpecData` narrowed `unknown → string | null` (it holds the streamed HTML per spec §7.2), plus `name?` (card header / workflow page name) and `status?: "streaming" | "ready" | "error"` for the DOM card lifecycle. `htmlContent` left as-is (unused).
- **Auto-height via `ResizeObserver`, not polling** (spec §7.2.8 says "ResizeObserver-style polling"): the card lives inside the `scale()` container so `offsetHeight` is already world units — the observer dispatches `updateShape({height})` with a 2px epsilon; no interval and no `/scale` math needed.
- **Canvas no longer draws a generated-ui body** — the DOM overlay renders it; the Canvas2D path draws nothing for `generated-ui` (selection outline/handles still drawn by the selection overlay), avoiding a gray flash under the card.
- **Workflow derive mode**: `pageType` sent as `"{name}: {description}"` truncated to the route's 200-char cap; derive call is per the route's improved dynamic-pages contract (no hardcoded page list).
- **Chat panel placement**: fixed right-side panel (spec §7.3 leaves anchoring open). Assistant bubbles show a compact "Design updated ✓" receipt rather than dumping the full replacement HTML in the bubble; on stream error the shape's HTML is rolled back to its pre-redesign value.
- **Frame snapshot export scale**: flat 2x, shrunk so the longest edge ≤ 2000px (spec §6.7 leaves sizing open); world-space stroke widths (no `/viewportScale` — export has no screen-constant sizing).

## Seam-review fixes (2026-07-19)

- **Zoom anchor**: `wheelZoom` payload coords are canvas-LOCAL (translate lives in canvas-local space); `use-canvas.ts` subtracts `getBoundingClientRect()` before dispatch.
- **Autosave staleness guard**: `projects.sketches_saved_at` (new schema field) + `savedAt` in the Inngest event + per-project concurrency limit 1 — retried/reordered jobs can no longer revert newer snapshots.
- **GeneratedUI hydration**: persisted `status: "streaming"` is downgraded on load (partial HTML → ready, empty → error) in the ProjectProvider.
- **generationApi RTK slice removed**: contracts mismatched the real routes and fetchBaseQuery buffers streaming responses; streaming clients are raw fetch in use-frame/use-chat-window. styleGuideApi/projectApi/billingApi remain (note: projectApi's `autosaveProject` and billingApi's `getCheckout` are currently unconsumed — the live autosave client is raw fetch in `use-autosave.ts` because it needs AbortController supersede + keepalive flush semantics).

---

## Review-pass fixes (2026-07-20)

Bugs found and fixed in a five-track code review (backend, canvas, redux, routing, doc-consistency):

- **Server-only Convex functions now secret-gated.** `subscriptions.getUserIdByEmail` / `upsertFromWebhook` / `grantCredits` / `getByPolarId` and `projects.updateSketchesFromWorkflow` were public functions callable by anyone with the deployment URL (which ships to the browser) — fake entitlements, unlimited credit minting, arbitrary project overwrites, and email→userId enumeration were all possible. They now require an `internalSecret` arg checked against a new `INTERNAL_FUNCTION_SECRET` env var (see `convex/internal_secret.ts`; fails closed if unset). The secret must be set BOTH in the Next.js server env and via `npx convex env set INTERNAL_FUNCTION_SECRET …`. `users.getUserById` (public, unused, leaked any user row) was deleted.
- **Credit-ledger idempotency scoped per user + type** (`by_user_and_idempotency_key` index added to `credits_ledger`): the old global-key dedupe meant a cross-user key collision (or a grant/consumption key collision) silently skipped a legitimate charge or grant. `consumeCredits` now returns `{consumed}`/`{consumed:false, reason:"duplicate"}` instead of `undefined` either way.
- **Generation idempotency keys are now always server-generated** (`buildIdempotencyKey` ignores the client `requestId`): honoring a client-sent key let a caller replay one key for unlimited generations at one credit. Client hooks still send `requestId`; it is ignored.
- **Storage deletion ownership check** (`moodboard.removeImage` / `inspiration.removeImage`): now verifies the `storageId` is actually in the project's image array before `ctx.storage.delete` — storage ids are deployment-global, so any project owner could previously delete ANY file in the deployment.
- **Autosave `savedAt` is stamped client-side** (in `use-autosave.ts`, monotonic with a +1 same-ms tiebreak) and passed through the PATCH route — the old server-side `Date.now()` ordered saves by handler completion, so an older save whose ownership check stalled could out-stamp and overwrite a newer one. Route falls back to server time if the client omits it.
- **Autosave unmount flush**: navigating away within the debounce window (or mid-PATCH) used to cancel the save and silently lose the last ~1s of edits; unmount now fires a final `fetch(..., {keepalive:true})` when unsaved changes exist (only after hydration).
- **Optimistic project delete now rolls back** (`use-project.ts`): on a failed remove mutation the project is re-inserted into the slice. `projects.create` (Convex) now returns the full doc so `createSuccess` stores real `project_number`/timestamps instead of fabricated ones; `ProjectProvider` mirrors the loaded doc into the projects slice (`upsertProject`) so export filenames work for projects opened, not created, this session. `removeProject` no longer decrements `total` for ids not in the list.
- **Selection/chat cleanup on shape removal**: `removeShape`/`removeShapes`/`clearShapes` now also drop removed ids from `selectedIds`, and the chat slice removes its per-shape session via `extraReducers` on the same actions (previously only the overlay delete button cleaned up chat; eraser/Delete-key leaked sessions).
- **Text resize implemented properly** (`canvas-hit-test.ts` `resizeShape`): scales `fontSize` (bounds ratio) and un-pads x/y instead of writing renderer-ignored width/height that also nudged the text by the 4px hit padding per drag. `generated-ui` resize no longer dispatches `height` (height is owned by the card's ResizeObserver; dispatching it fought the observer mid-drag). `TEXT_HIT_PADDING` documented as world-space (it is not `/scale`d, unlike the other thresholds).
- **Canvas interaction hardening**: `window` blur clears held Space/Shift state (Alt+Tab no longer sticks the canvas in pan/snap mode); non-primary pointers are ignored (second touch no longer corrupts an in-progress gesture — full multi-touch/pinch is still NOT implemented, deviation from spec §6.2/§6.4 `touchMapRef`); rAF cleanup resets the scheduling guards (`isPanningRef`/`animationFrameRef`) so an effect re-run (HMR) can't permanently kill wheel/pointer processing; the text-edit overlay calls `onDone` if its shape disappears externally (previously a vanished shape left `editingTextId` set, permanently blocking all canvas keyboard shortcuts); the generated-ui card's height-epsilon baseline follows external `shape.height` changes.
- **Geist Sans actually applied**: `globals.css` had `--font-sans: var(--font-sans)` (self-reference, body text fell back to the browser default); now `var(--font-geist-sans)`.
- **Spec §6.5 note**: resize is handled inline in the pointer handlers, not via the spec's `shape:resize-start/move/end` custom events (functionally equivalent; recorded here so nobody hunts for the events).
- **Known gaps, deliberately not fixed in this pass** (pending billing frontend phase): the dashboard root page (`(protected)/dashboard/page.tsx`) is a client-side slug redirect with NO server-side entitlement gate (spec §4 calls for an entitlement check → `/billing/{slug}` redirect); readme §11's `dashboard/billing/*` pages, `use-billing.ts`, and checkout button components do not exist yet; `convex/query.config.ts` (server preload helpers) and readme §5's profile `preloadedState` hydration are unimplemented (the profile slice is currently dead state — navbar reads Convex directly). *(All closed later the same day — see next section.)*

---

## Billing frontend + preload phase (2026-07-20)

Closes every "known gap" from the review pass:

- **Server-side entitlement gate**: `(protected)/dashboard/page.tsx` is now an async server component — mints the Convex token, syncs the users row if the client-side AuthSync hasn't run yet (`storeUser` server-side fallback), checks `subscriptions.isEntitled`, and redirects to `/dashboard/billing/{slug}` (unentitled) or `/dashboard/{slug}` (entitled). No client-side gap.
- **Billing pages built** (readme §11): `dashboard/billing/[session]/page.tsx` (plan card + checkout CTA; server-checked — already-entitled users bounce back to the dashboard) and `dashboard/billing/success/page.tsx` (Polar successUrl target; watches the reactive `isEntitled` query since webhook processing is async, then forwards to `/dashboard`).
- **`use-billing.ts` + `CheckoutButton`** (`components/buttons/checkout-button.tsx`): checkout via the (previously dead) `billingApi.getCheckout` RTK Query endpoint, then `window.location.assign`. The endpoint's `userId` query param was REMOVED — the route resolves the user from the Clerk session and never trusted the param; the old client contract sending it was misleading.
- **Preload helpers**: `src/lib/preload.ts` (`getConvexToken`, `preloadAuthedQuery`) — the readme §11 `convex/query.config.ts` location is wrong for these: everything under `convex/` is pushed to the Convex deployment, and the helpers need `@clerk/nextjs/server`, so they live in `src/lib/`.
- **Profile `preloadedState` hydration implemented** (spec §5): root layout is now async, preloads `users.currentUser` server-side, and passes `{ profile: { user } }` into `StoreProvider`; the navbar renders the preloaded profile until the live Convex query resolves (no flicker). Fail-soft null when signed out.
- **`STANDARD_PLAN_CREDITS` moved to `src/lib/billing.ts`** (re-exported from `inngest/functions.ts` for compat) so client components can show plan facts without bundling the Inngest server plumbing.
- **Clerk post-auth redirect fixed**: `.env.local`/`.env.example` `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `SIGN_UP_...` pointed at `/` (the public landing page — signing in dropped you back on the marketing page); now `/dashboard` so the entitlement gate takes over.
- **Verified running** (dev, Turbopack): landing/sign-in/sign-up compile and serve 200 (cold ≈ first-compile cost 3–16s, warm ~0.3–0.7s); Clerk `<SignIn>`/`<SignUp>` mount on `/sign-in`//`/sign-up`; unauthenticated browser-like requests to `/dashboard` get a 307 to the Clerk handshake (curl without browser headers sees Clerk's `protect-rewrite` 404 — expected `auth.protect()` behavior for non-navigation requests).

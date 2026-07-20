# S2C — Execution Plan

Companion to `s2c-build-spec.md`. That doc is the *what*; this one is the *how and in what order*, with a prompt template and a "done" checklist for every phase so you know when to stop and move on rather than letting Claude Code keep expanding a phase forever.

---

## 0. Before Writing Any Code

Set these up first — several phases will stall waiting on external accounts, and it's faster to get them all provisioned once than to context-switch mid-build.

- [ ] GitHub repo created (empty is fine — you'll scaffold into it).
- [ ] Convex account + new project created (don't run `npx convex dev` yet — do that in Phase 1).
- [ ] Anthropic Console account + **add $15–20 in credits** (image/vision calls are the expensive ones — style guide + design generation both send images).
- [ ] Polar account — use **sandbox.polar.sh** for the entire build, switch to production only at deploy time.
- [ ] Inngest account (free tier is fine for dev).
- [ ] ngrok account — get the **paid static domain** ($8–10/mo) up front. The alternative (free tier's rotating URL) means re-pointing Google OAuth, Convex site URL, and Polar webhooks every time the tunnel restarts, which will burn more time than the subscription costs.
- [ ] CodeRabbit — connect to the GitHub repo, install the free VS Code/Cursor extension.
- [ ] Hosting account (Sevalla or equivalent) — just create the account now, don't deploy anything yet.
- [ ] Google Cloud Console project — create it now, but you'll finish OAuth client setup inside Phase 1 once you have the ngrok domain and Convex site URL to fill in.

**Branching strategy:** trunk-based. One `main` branch. Every phase below = one feature branch → PR → CodeRabbit review → merge → tag. Don't skip the PR step even solo; CodeRabbit's diagram + bug-catch is doing real work for free.

---

## 1. How to Run Each Phase With Claude Code

1. **One phase = one fresh Claude Code session.** Don't chain phases in the same context — once a phase is verified working, start the next phase clean and only feed it what it needs (current schema, current relevant files, the relevant section of the build spec). Long-running sessions drift and start "fixing" things that already work.
2. **Maintain a `DECISIONS.md`** at the repo root. Any time you deviate from the build spec (different library version, different folder name, different table field), log it there in one line. Paste the current `DECISIONS.md` into every new phase's prompt so Claude Code stays consistent with your actual codebase, not the original transcript.
3. **After every phase:** run it manually, click through the actual feature, fix what's broken, commit, *then* move on. Do not stack phase 2 on top of an unverified phase 1.
4. **Use the "Done when" checklist** at the end of each phase below as your literal merge gate. If it doesn't pass, that's still the same phase, not a new task.
5. Copy each "Suggested Claude Code prompt" as a starting point — paste in the relevant excerpt from `s2c-build-spec.md` alongside it.

---

## 2. Phase-by-Phase Plan

### Phase 0 — Scaffold
**Depends on:** nothing.
**Steps:**
- `npx create-next-app@15.4.6` (TS, ESLint, Tailwind, `src/`, App Router, Turbopack, no import alias).
- `npx shadcn@latest init` (neutral base color), then install all components at once.
- Theme provider (forced dark mode) + `<Toaster />` wired into root layout.
- Push to `main`.

**Claude Code prompt:**
> Scaffold a Next.js 15.4 app with TypeScript, Tailwind v4, App Router, `src/` directory. Install shadcn/ui with all components. Add a theme provider forced to dark mode and a `<Toaster />` from sonner in the root layout. No pages beyond the default yet.

**Done when:** `npm run dev` shows a blank dark-mode page with no console errors, `npx shadcn add <anything>` works.
**Est:** 1 short session.

---

### Phase 1 — Convex + Auth
**Depends on:** Phase 0, ngrok static domain, Google Cloud project.
**Steps:**
- `npx convex dev` — scaffold, log in, link project.
- Install `@convex-dev/auth`, run its manual setup (schema tables, `auth.config.ts`, `http.ts`).
- Google OAuth client in Google Cloud Console: authorized origin + redirect URI pointing at your Convex **action URL** (not the site URL directly — check the exact callback path Convex Auth generates).
- Set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` via `npx convex env set`, not `.env`.
- Point Convex's `SITE_URL` env var at your ngrok static domain.
- Build `middleware.ts` in `src/` with bypass/public/protected route matchers.
- Build sign-in/sign-up pages (shadcn blocks or Tailark), wire up `useAuth` hook (Zod schemas for email/password/name).
- `users`, `project_counters`, `projects`, `credits_ledger`, `subscriptions` tables in `convex/schema.ts` (full fields from build spec §3).

**Claude Code prompt:**
> Set up Convex Auth with Google OAuth and Password providers in this Next.js app. Add middleware with public/protected/bypass route matchers under `src/middleware.ts`. Build `/auth/signin` and `/auth/signup` pages using shadcn components, with react-hook-form + zod validation, and a `useAuth` hook exposing signIn/signUp/signOut and loading state. Also create the Convex schema exactly as specified: [paste §3 from build spec].

**Done when:** You can sign up with email/password, sign in with Google, land on a protected page, get redirected to sign-in when logged out, and see all 4 extra tables in the Convex dashboard.
**Est:** 2–3 sessions (OAuth setup + ngrok wiring is the slow part, not the code).

---

### Phase 2 — Redux Plumbing
**Depends on:** Phase 1.
**Steps:**
- `store.ts` (SSR-safe `makeStore()`), `provider.tsx` (client, `useRef`-held store).
- Empty `profile` and `projects` slices.
- `projectApi` RTK Query slice scaffold (no real mutations yet beyond a placeholder).
- Root layout: server-fetch the current user's profile, normalize it, hydrate into `preloadedState`.

**Claude Code prompt:**
> Add Redux Toolkit + RTK Query to this app. Create an SSR-safe store factory, a client Provider component holding the store in a ref, a `profile` slice, an empty `projects` slice, and a `projectApi` RTK Query slice with a placeholder query. In the root layout, server-fetch the authenticated user's profile via Convex and hydrate it into the store's preloaded state so the navbar has it on first paint.

**Done when:** `useAppSelector(s => s.profile.user)` returns real data on first client render with no flash of empty state.
**Est:** 1 session.

---

### Phase 3 — Dashboard Shell + Project CRUD
**Depends on:** Phase 2.
**Steps:**
- Navbar (user avatar, credits placeholder, create-project button).
- Project list page, optimistic create via Convex mutation + Redux dispatch (`addProject` before the mutation resolves).
- Dashboard root page: entitlement check → redirect to `/billing/{slug}` or into the project list. (Billing entitlement doesn't exist yet — hardcode `entitled = true` for now, replace in Phase 10.)
- Project canvas/style-guide route shells (empty pages, just routing + layout for now).

**Claude Code prompt:**
> Build the dashboard shell: a navbar with user avatar and a "New Project" button, a project list page that creates projects optimistically (dispatch to Redux immediately, then confirm via a Convex mutation), and empty route shells for `/dashboard/[session]/workspace/canvas` and `.../style-guide`. Hardcode subscription entitlement as always true for now — I'll wire real billing in a later phase.

**Done when:** You can click "New Project," see it appear instantly, refresh and still see it, and click into it to land on an empty canvas page.
**Est:** 1–2 sessions.

---

### Phase 4 — Canvas Engine (the big one — split into sub-phases, don't attempt as one task)

This is the largest phase by far. Do **not** ask Claude Code to build "the whole canvas" in one prompt — go shape-by-shape and mechanism-by-mechanism, verifying each before the next.

#### 4a. Viewport (pan/zoom) only, no shapes yet
- `viewport` slice + wheel handlers (Ctrl/Cmd+wheel = zoom, plain wheel = pan) + `screenToWorld`/`worldToScreen`.
- **Done when:** an empty canvas pans and zooms smoothly with the number readout updating.

#### 4b. Basic shapes (rectangle, ellipse, frame)
- `shapes` slice with entity adapter, `addRectangle`/`addEllipse`/`addFrame`, draw-drag-commit flow with a draft/preview shape.
- **Done when:** you can select the rectangle tool, drag out a shape, see a lighter preview while dragging, and see it commit on release.

#### 4c. Selection + move + resize
- Hit-testing for rect/ellipse/frame, selection overlay, drag-to-move (single and multi-select), resize handles per corner.
- **Done when:** click selects, shift-click multi-selects, dragging moves all selected together, corner handles resize correctly.

#### 4d. Free draw (pencil) + eraser
- Point accumulation, throttled rendering, distance-to-segment hit-testing, eraser drag-to-delete.
- **Done when:** you can scribble smoothly (no lag), select/erase a scribble by clicking near it, not just exactly on a point.

#### 4e. Line + arrow
- Segment-based shapes, arrow-head math, resize special-casing (map bounds back to start/end).
- **Done when:** lines/arrows draw, select, move, and resize (including degenerate vertical/horizontal cases) without breaking.

#### 4f. Text tool
- Click-to-place, editable input, sidebar for font family/size/weight/style/color, bounding-box hit-testing.
- **Done when:** you can add text, edit it, style it from the sidebar, and click away to commit.

**Overall Phase 4 Claude Code prompt template (use once per sub-phase, not once total):**
> Add [rectangle/ellipse/frame | free draw + eraser | line + arrow | text] support to the existing canvas engine. Follow the exact architecture in this excerpt of the build spec: [paste relevant §6 subsection]. Use refs (not state) for anything updated during drag/draw. Do not touch the existing [previously built shape] logic.

**Est:** 5–8 sessions total across 4a–4f. This is realistically 40–60% of total build time — budget accordingly.

---

### Phase 5 — Mood Board + Style Guide AI
**Depends on:** Phase 1 (storage), Phase 4 done (need a working canvas/style-guide tab shell).
**Steps:**
- Drag-and-drop upload to Convex storage (native drag events, no library), optimistic blob previews swapped for server URLs.
- `generateUploadUrl` / add / remove mutations, max-count enforcement.
- `/api/generate/style` route: credit check → `generateObject` with the Zod schema from build spec §7.1 → save to `projects.style_guide`.
- Render colors + typography tabs from the saved style guide.

**Claude Code prompt:**
> Build the mood board: drag-and-drop image upload to Convex storage with optimistic local previews, a "Generate with AI" button that calls a new `/api/generate/style` route. That route should check/consume a credit, call Anthropic via the Vercel AI SDK's `generateObject` with this exact Zod schema: [paste §7.1], and save the result to the project's `style_guide` field. Render the result as color swatches and typography samples in the existing style-guide tabs.

**Done when:** uploading images works with instant preview, generating produces a real color palette + typography from those images, and it persists on refresh.
**Est:** 2 sessions.

---

### Phase 6 — Inspiration Images
**Depends on:** Phase 5 (same upload pattern, reused).
**Steps:** Same upload/storage pattern as Phase 5, project-scoped, no AI call of its own — just feeds later generation calls.

**Done when:** images upload/delete correctly and are queryable per project.
**Est:** 1 session (mostly copy-paste of Phase 5's pattern).

---

### Phase 7 — Sketch → Design Generation
**Depends on:** Phase 4 (frame shapes + canvas), Phase 5 (style guide), Phase 6 (inspiration images).
**Steps:**
- `generateFrameSnapshot()` — off-screen canvas render of everything inside a frame → blob → base64.
- `/api/generate` route: credit check, build prompt (style guide + inspiration URLs + explicit Tailwind semantic-class instruction), `streamText`.
- Stream consumption on the client: dispatch a `generated-ui` shape immediately with `uiSpecData: null`, update it as chunks arrive.
- Sanitize before `dangerouslySetInnerHTML`. Auto-grow shape height to fit content.

**Claude Code prompt:**
> Implement sketch-to-design generation. On "Generate Design," export everything inside the clicked frame to a PNG using Canvas 2D (not html-to-image) — follow this exact rendering approach: [paste §6.7]. Send it to a new `/api/generate` route along with the project's style guide and inspiration image URLs, following this prompt structure: [paste §7.2]. Stream the HTML response back and render it live into a new `generated-ui` shape positioned next to the source frame, sanitizing the HTML before rendering it, and auto-growing the shape's height to fit the rendered content.

**Done when:** sketching a frame and clicking generate produces a real streamed design next to it, matching the sketch's rough layout and the project's color palette, and persists after refresh.
**Est:** 2–3 sessions — this is the "wow" feature, worth extra iteration time on the prompt itself once the plumbing works.

---

### Phase 8 — Chat Redesign
**Depends on:** Phase 7.
**Steps:** `chat` slice keyed by generated-UI shape ID, chat panel UI, `/api/generate/redesign` route (same streaming pattern, replaces the shape's HTML in place).

**Done when:** typing a redesign request in a generated screen's chat updates that screen's HTML live, and chat history persists per-screen while the canvas session is open.
**Est:** 1–2 sessions.

---

### Phase 9 — Workflow Generation
**Depends on:** Phase 7.
**Steps:** Batch-generate N additional pages positioned to the right of the first, `Promise.all`'d, success/failure toast summary.
**Improvement over source project:** derive the N page types dynamically (ask the first generation call to also suggest follow-on pages) instead of hardcoding a page-type list.

**Done when:** clicking "Generate Workflow" produces multiple new screens streaming in parallel, each contextually different but visually consistent with the first.
**Est:** 2 sessions.

---

### Phase 10 — Billing (Polar + Inngest)
**Depends on:** Phase 1 (users/subscriptions table), independent of canvas work — can actually be built in parallel with Phase 4 if you have two work streams.
**Steps:**
- Install Inngest, `/api/inngest` route, `ingest/client.ts` + `ingest/functions.ts`, sync app to Inngest dashboard (via ngrok URL in dev).
- `/api/billing/checkout` (GET, creates Polar session).
- `/api/billing/webhook` (POST, raw-body signature verification, forwards to Inngest event).
- Inngest function: resolve user → upsert subscription (idempotent, preserve credit balance) → grant credits (idempotent) → sync event → sleep-until-expiry → recheck.
- `consumeCredits` mutation with idempotency key, called **after** successful AI generation in every generation route (go back and fix Phases 5/7/8/9's credit-consumption ordering here).
- Replace the Phase 3 hardcoded `entitled = true` with the real entitlement check.

**Claude Code prompt:**
> Wire up Polar billing with Inngest as the background processor. Build a checkout route, a webhook route that verifies the raw signed payload and forwards to an Inngest event, and an Inngest function that idempotently upserts the subscription (preserving existing credit balance), grants credits idempotently, and schedules a recheck at period end using `step.sleepUntil`. Follow this exact flow: [paste §8]. Then update every existing `/api/generate/*` route so credits are consumed only *after* a successful AI response, not before.

**Done when:** you can subscribe with a real (sandbox) card, land on a success page, see your credit balance update, generate designs that decrement it, and the dashboard properly blocks unentitled users.
**Est:** 3–4 sessions — webhook/Inngest sync friction (especially through ngrok) eats real time here.

---

### Phase 11 — Autosave (Inngest)
**Depends on:** Phase 10 (Inngest already wired), Phase 4 (shapes/viewport to save).
**Steps:** Debounced client watcher on shapes/viewport → `PATCH /api/project` (with ownership check — this was missing in the source project, don't skip it) → Inngest event → Convex mutation. Status indicator in navbar.

**Done when:** editing the canvas shows a saving→saved indicator, and refreshing mid-edit-storm doesn't lose data even if you kill the tab right after an edit.
**Est:** 1–2 sessions.

---

### Phase 12 — Export
**Depends on:** Phase 7.
**Steps:** PNG export of a generated screen via `html-to-image`, download trigger.

**Done when:** clicking export downloads a clean PNG of the generated design.
**Est:** 1 session.

---

### Phase 13 — Hardening Pass
**Depends on:** everything above functionally working.
**Steps (all from build spec §14):**
- Add ownership checks to every mutation/route that's missing one (autosave especially).
- Audit the HTML sanitizer against nested/obfuscated script injection.
- Confirm credit consumption happens after success everywhere.
- Simplify/harden the subscription user-resolution logic (metadata vs. email fallback) instead of leaving defensive duplicate-detection code around it.
- Run CodeRabbit's full-repo review, work through every flagged item, prioritizing anything marked critical/security.

**Done when:** CodeRabbit's review has no unresolved critical/security findings and you've personally verified each of the 5 items above.
**Est:** 1–2 sessions.

---

### Phase 14 — Testing
**Depends on:** Phase 13.
**Steps:** Jest + React Testing Library, behavior-driven test cases (test what the user sees/does, not implementation), target ~80% coverage, real components (no mocking the thing under test).

**Claude Code prompt:**
> Write Jest + React Testing Library tests for [component/route], following behavior-driven test cases, not implementation-detail tests. Render the real component (don't mock it), test from the perspective of a screen reader / user interaction, and target meaningful coverage of the actual user-facing behavior described here: [describe the flow]. Do not fake a passing test by mocking the component you're supposed to be testing.

**Done when:** `npm run test -- --coverage` shows ~80%+ and every test failure has actually been fixed, not skipped.
**Est:** 2–3 sessions.

---

### Phase 15 — Deployment
**Depends on:** everything above.
**Steps:**
- Push final build, connect hosting to GitHub with auto-deploy on commit.
- Set up dev/staging/production pipelines with **separate isolated environment variables per environment** (separate Polar sandbox vs. live keys, separate Convex deployments if desired).
- Swap Polar from sandbox to live mode for production only.
- Update Google OAuth authorized origins/redirect URIs and Convex `SITE_URL` to the real production domain (remove ngrok entirely at this point).
- Re-sync Inngest to the production URL.
- Custom domain + Cloudflare protection (usually automatic with the host).

**Done when:** the production URL (not ngrok, not a dev URL) supports full sign-up → subscribe (real payment) → sketch → generate → autosave → refresh, end to end.
**Est:** 1–2 sessions, mostly waiting on DNS/webhook re-syncing.

---

## 3. Dependency Graph (what blocks what)

```
Phase 0 → 1 → 2 → 3
                  └→ 4 (a→b→c→d→e→f, sequential)
1 → 10 (billing) can run in parallel with 4, once merged both feed into 3's entitlement check
4 → 5 → 6 → 7 → 8
              └→ 9
4,10 → 11 (autosave)
7 → 12 (export)
[everything] → 13 → 14 → 15
```

The only real parallelization opportunity for a small team: **Phase 4 (canvas) and Phase 10 (billing)** touch almost entirely different parts of the codebase and can be built by two people/two sessions simultaneously, merging just before Phase 5 needs both.

---

## 4. Rough Session Budget

| Block | Phases | Sessions |
|---|---|---|
| Foundation | 0–3 | 4–6 |
| Canvas engine | 4a–4f | 5–8 |
| AI features | 5–9 | 8–11 |
| Billing + autosave | 10–11 | 4–6 |
| Export/hardening/tests/deploy | 12–15 | 5–8 |
| **Total** | | **~26–39 sessions** |

("Session" = one focused Claude Code task through to a verified, committed done-state — not a calendar day. Solo, expect this to span several weeks of part-time work; the source creator's team took ~2.5 weeks full-time.)

---

## 5. When to Deviate From This Plan

- If Phase 4 (canvas) is taking too long, ship an MVP with **rectangle + text + frame only** and defer free-draw/line/arrow to a v1.1 — the AI generation features don't strictly need every shape type to demo well.
- If Polar/Inngest webhook wiring through ngrok is eating disproportionate time, consider testing billing against Polar's dashboard-triggered test events instead of full end-to-end checkout during early iterations, and only do a full live-checkout test right before Phase 15.
- Anything in build spec §14 ("Known Gaps") is safe to fix *during* its originating phase instead of waiting for Phase 13, if you notice it early — Phase 13 is a safety net, not the only place those fixes are allowed to happen.
# S2C — "Sketch to Code" — Full Technical Build Spec

**What it is:** An AI-powered SaaS for designers. Users sketch wireframes on an infinite canvas (Excalidraw/Figma-like), build a mood board, and AI (Claude) generates full HTML/Tailwind UI designs from the sketch + style guide + inspiration images. Includes multi-page "workflow" generation, per-screen AI chat redesign, subscriptions/credits, and autosave.

This doc is organized so you can hand sections of it to Claude Code as separate, scoped tasks rather than asking for the whole app at once.

---

## 1. Tech Stack Overview

| Layer | Choice |
|---|---|
| Framework | Next.js 15.4.x (App Router, TypeScript, `src/` dir, Turbopack, ESLint) |
| Styling | Tailwind CSS v4 (no `tailwind.config`, theme lives in `globals.css`) |
| UI Kit | shadcn/ui (all components installed up front) + Tailark community blocks for auth pages |
| Icons | lucide-react |
| State | Redux Toolkit + React-Redux + RTK Query (`createApi`) |
| Forms | react-hook-form + @hookform/resolvers/zod + zod |
| Backend/DB | Convex (reactive DB + serverless functions + file storage + auth) |
| Auth | Convex Auth (`@convex-dev/auth`) — Google OAuth + Password |
| Background jobs | Inngest (event-driven functions, steps, retries, sleep/scheduling, realtime) |
| Payments | Polar.sh (`@polar-sh/sdk`) — merchant of record, subscriptions, webhooks |
| AI | Anthropic Claude via Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) — `generateObject` (style guide) and `streamText` (design generation, redesign, workflow) |
| Canvas engine | 100% custom-built (no Fabric.js/Konva/tldraw) — raw HTML5 Canvas 2D + Redux |
| Image export | Native Canvas 2D rendering → Blob, plus `html-to-image` for DOM screenshots |
| Toasts | sonner |
| Dates | date-fns |
| Local tunneling (dev) | ngrok (static domain recommended — needed for Google OAuth callback + Polar/Convex webhooks) |
| Code review | CodeRabbit (free tier, GitHub + IDE extension) |
| Hosting | Sevalla-style Next.js host — GitHub auto-deploy, per-environment env vars, built-in Cloudflare DDoS protection, horizontal+vertical scaling |
| Testing (pre-launch) | Jest + React Testing Library, behavior-driven, ~80% coverage target |

---

## 2. Package List (as referenced in the source project)

```bash
# scaffold
npx create-next-app@15.4.6   # TS, ESLint, Tailwind, src dir, App Router, Turbopack, no import alias

# shadcn
npx shadcn@latest init       # base color: neutral
npx shadcn@latest add        # then remove "button" arg trick to install ALL components

# state
npm i react-redux@9.2.0
npm i @reduxjs/toolkit@2.8.2

# convex
npm i convex
npx convex dev                       # scaffolds convex/ folder, logs in, links project
npx convex@convex-dev/auth@0.0.88    # manual auth setup helper

# forms
# zod + react-hook-form resolvers ship in with shadcn, but confirm:
npm i react-hook-form zod
npm i @hookform/resolvers

# ui helpers
npm i date-fns
npm i sonner   # (comes bundled via shadcn add, but confirm)

# AI
npm i ai
npm i @ai-sdk/anthropic

# background jobs
npm i inngest@1.11.3
npm i @inngest/realtime@0.3.1

# payments
npm i @polar-sh/sdk@0.34.12

# canvas export
npm i html-to-image@1.11.13

# next config
# next.config: images.remotePatterns -> https://*.convex.cloud
```

> Pin exact versions where given — this project was built against these specific releases and using different majors (e.g. RTK Query, Tailwind, Convex Auth) can break the patterns described below.

---

## 3. Convex Schema (`convex/schema.ts`)

```
project_counters
  - user_id            (indexed by user)
  - next_project_number

projects
  - user_id
  - name
  - description
  - style_guide          (JSON: theme, colors[], typography[])
  - sketches_data         (JSON: normalized shapes — mirrors Redux shapes slice shape)
  - viewport_data         (JSON: scale, translate x/y)
  - mood_board_images     (string[] of Convex storage IDs)
  - inspiration_images    (string[] of Convex storage IDs)
  - last_modified
  - created_at
  - is_public
  - tags
  - project_number

credits_ledger
  - user_id
  - subscription_id
  - amount
  - type
  - reason
  - idempotency_key      (dedupes retried grants/consumption)
  - metadata
  - created_at

subscriptions
  - user_id
  - polar_subscription_id
  - polar_customer_id
  - price_id
  - plan_code
  - status                (active | trialing | canceled | ...)
  - current_period_end
  - cancel_at
  - trial_ends_at
  - credit_balance
  - last_grant_cursor      (idempotency key for last credit grant)
```

All tables use indexes on `user_id` (and `project_id` where relevant) since Convex queries require an index to filter efficiently.

---

## 4. Auth Architecture

- **Convex Auth** (`@convex-dev/auth`) — configured with `Google` (OAuth core) and `Password` providers.
- Google Cloud Console: OAuth consent screen + Web Application OAuth client.
  - Authorized JS origins: your Convex **site URL** (and localhost for dev).
  - Authorized redirect URI: `{CONVEX_SITE_URL}/api/auth/callback/google`.
- Convex env vars set via `npx convex env set AUTH_GOOGLE_ID ...` / `AUTH_GOOGLE_SECRET ...`.
- `middleware.ts` (in `src/`, not root) uses `convexAuthNextjsMiddleware`:
  - `isBypassRoute` — routes to skip entirely.
  - `isPublicRoute` — if authenticated and hitting these, redirect to `/dashboard`.
  - `isProtectedRoute` (everything under `/dashboard`) — if unauthenticated, redirect to `/auth/signin`.
  - Sets a cookie config for auth persistence.
- **Custom `useAuth` hook** wraps Convex's `useAuthActions` — exposes `signIn`, `signUp`, `signOut`, loading state, and react-hook-form instances (with Zod schemas for email/password, first/last name).
- Dashboard root page (`/dashboard/page.tsx`) is really a **routing gate**: checks subscription entitlement server-side → redirects to `/billing/{slug}` (no entitlement) or `/dashboard/{slug}/{session}` (entitled), where `{slug}` is a normalized username.
- ⚠️ Production hardening flagged by the code review pass in the source project: move ownership/entitlement checks into a proper Data Access Layer (DAL), not just page-level checks — page-level alone is not sufficient defense in depth.

---

## 5. State Management (Redux Toolkit + RTK Query)

**Store setup** (`redux/store.ts`):
- `makeStore()` factory (needed for SSR — no singleton store).
- `combineReducers` over a `slices` map (`redux/slices/index.ts`) containing: `profile`, `projects`, `shapes`, `viewport`, `chat`.
- `configureStore` middleware: `getDefaultMiddleware().concat(...apis.map(api => api.middleware))`.
- Supports a `preloadedState` param (server-fetched profile data hydrated into the store at root layout render — avoids loading flicker for the navbar user info).
- `Provider.tsx` (client component) holds the store in a `useRef` so it survives re-renders, wraps children in `<Provider store={storeRef.current}>`.

**RTK Query API slices** (each in `redux/api/<domain>/index.ts`, all registered in `redux/api/index.ts` and merged into the reducer + middleware):
- `projectApi` — `autosaveProject` mutation (PATCH `/api/project`).
- `styleGuideApi` — `generateStyleGuide` mutation (POST `/api/generate/style`).
- `billingApi` — `getCheckout` lazy query (GET `/api/billing/checkout`).
- `generationApi` — `generate`, `redesign`, `generateWorkflow`, `redesignWorkflow` mutations (all POST to `/api/generate/*`).

**Redux slices:**
- `profile` — `{ user: NormalizedProfile | null }`, actions `setProfile` / `clearProfile`.
- `projects` — list state (`projects[]`, `total`, `isLoading`, `error`, `isCreating`, `createError`) with reducers for fetch start/success/failure, create start/success/failure, add/update/remove/clear.
- `shapes` — uses an **entity adapter** (normalized `{ ids: [], entities: {} }`) for canvas shapes, plus `tool`, `selectedFrameCounter`, selection state. Reducers per-shape-type (`addFrame`, `addRectangle`, `addEllipse`, `addArrow`, `addLine`, `addFreeDrawShape`, `addText`, `addGeneratedUI`, `updateShape`, `removeShape`, `clearShapes`, `loadProject`, `selectShape`, `clearSelection`, `setTool`).
- `viewport` — scale/translate state + reducers for wheel-zoom, wheel-pan, pan start/move/end (dispatched via `requestAnimationFrame`-throttled handlers, not raw event handlers, to avoid excessive re-renders).
- `chat` — per-screen chat history: `Record<generatedUIId, { messages[], isStreaming, streamingMessageId }>`, with `initializeChat`, `addUserMessage`, `startStreamingResponse`, `updateStreamingContent`, `finishedStreamingResponse`, `handleError`, `clearChat`, `removeChat`.

---

## 6. Canvas Engine (the hardest part — build this incrementally)

This is a **from-scratch infinite canvas**, not a wrapper around a library. Core hook: `useInfinityCanvas` (huge — build it in the sub-pieces below, one Claude Code task per piece).

### 6.1 Coordinate system
- `canvasRef` (the actual `<canvas>`/container DOM node).
- `getLocalPointFromClient(clientX, clientY)` → converts screen coords to canvas-local coords using `getBoundingClientRect()`.
- `screenToWorld` / world↔screen conversions live in the `viewport` slice (pure functions), applying `scale` + `translate`.

### 6.2 Refs (non-rerendering state — critical for performance)
Use `useRef` for anything updated at 60fps so you don't thrash React re-renders:
- `canvasRef`, `touchMapRef` (multi-touch), `draftShapeRef` (shape being drawn, not yet committed), `freeDrawPointsRef`, `spacePressedRef`, `drawingRef`, `moveStartRef`, `initialShapePositionsRef` (baseline positions before a drag, for smooth multi-shape movement), `erasingRef` + `erasedShapesRef`, `resizingRef` + `resizeDataRef` (corner, initial bounds), `animationFrameRef`s for pan/freehand.
- A manual `forceRender()` (via a dummy `useState` counter) to force a re-render only when a ref-based value actually needs to hit the DOM.

### 6.3 Shape hit-testing (`getShapeAtPoint`)
Per-type point-in-shape math, checked in reverse z-order (topmost first):
- **frame/rectangle/ellipse/generated-UI** — simple bounding-box check.
- **free draw** — distance-to-line-segment check against every consecutive point pair, with a small threshold (~5px).
- **line/arrow** — distance-to-line-segment against the single start→end segment, larger threshold (~8px) for easier clicking.
- **text** — approximate bounding box computed from `text.length * fontSize * 0.6` (width) and `fontSize * 1.4` (height) + padding, since text has no fixed box.

### 6.4 Pointer event handlers
- `onWheel` — Ctrl/Cmd+wheel = zoom (dispatch `wheelZoom`); plain wheel = pan (dispatch `wheelPan`).
- `onPointerDown` — branches on current tool:
  - **select** — hit-test, handle shift-click multi-select, store `initialShapePositionsRef` for every selected shape (different math per shape type: bounds vs. `points[]` vs. start/end).
  - **eraser** — hit-test + remove on click, `erasedShapesRef` tracks what's been erased this drag to avoid duplicate removes.
  - **text** — dispatch `addText` at click point, auto-switch tool to `select`.
  - **frame/rectangle/ellipse/arrow/line** — start `draftShapeRef` (preview only, not committed).
  - **free draw (pencil)** — push first point to `freeDrawPointsRef`.
- `onPointerMove` — updates draft shape / free-draw points / drags selected shapes (recomputing every selected shape's new position from its stored initial position + delta) / eraser drag-to-delete.
- `finalizeDrawing()` — converts the draft shape into a real dispatched shape (only if it exceeds a minimum size threshold) and clears the draft ref.
- `onPointerUp` / `onPointerCancel` — release pointer capture, finalize drawing, reset moving/resizing/erasing state.
- Keyboard — spacebar held = temporary pan mode override even on `select` tool.

### 6.5 Resize handles
A separate `useEffect` wires `shape:resize-start/move/end` custom events. Resize math branches per shape type:
- rect/ellipse/frame — recompute bounds per corner (NW/NE/SW/SE), each corner anchors the opposite corner.
- free draw — recompute the shape's own bounding box, then **proportionally rescale every point** relative to the new bounds.
- line/arrow — special-cased: no width/height, so map new bounds back onto start/end coordinates, handling degenerate cases (vertical-only, horizontal-only, diagonal).

### 6.6 Shape rendering
Two paths:
1. **Committed shapes** → `<ShapeRenderer>` switch-cases over shape type, rendering React components (`Frame`, `Rectangle`, `Ellipse`, `Arrow`, `Line`, `Stroke`(free draw), `Text`, `GeneratedUI`), each with a lighter-weight `Preview` variant used while `draftShapeRef` is active.
2. **Selection overlay** — a separate `Selection` component draws resize handles/bounding box around whatever's currently selected.

### 6.7 Frame → AI export (canvas-to-image pipeline)
`generateFrameSnapshot(frame, allShapes)`:
1. Find all shapes geometrically inside the frame bounds (`getShapesInsideFrame` — bounds-overlap check per shape type).
2. Create an off-screen `<canvas>` sized to the frame, get 2D context, fill black background, clip to frame bounds.
3. `renderShapeOnCanvas()` — re-draws each contained shape using raw Canvas 2D API calls (`beginPath`, `moveTo`, `lineTo`, `roundRect`/`ellipse`, `stroke`, `fillText`, and manual arrow-head trigonometry for arrows).
4. `canvas.toBlob('image/png', 1.0)` wrapped in a Promise.
5. Convert blob → base64 (via ArrayBuffer) to send to Claude as an image input.

---

## 7. AI Generation Pipelines

All AI calls go through Next.js API routes (`app/api/generate/**/route.ts`) so API keys never reach the client, and all consume credits server-side.

### 7.1 Style Guide Generation — `POST /api/generate/style`
1. Validate `projectId`, check credit balance > 0.
2. Consume 1 credit (idempotent via ledger).
3. Fetch mood board images (Convex storage URLs) for the project.
4. `generateObject()` (Vercel AI SDK + Anthropic) with a **Zod schema**:
   ```
   styleGuideSchema = {
     theme: string,
     description: string,
     colors: { primary, secondary, accent, ui, status }[] (each with title + swatches[{name, hex, description}]),
     typography: { title, styles[{name, fontFamily, fontSize, ...}] }[]
   }
   ```
5. System prompt + user prompt reference the mood board image URLs directly.
6. Save result JSON into `projects.style_guide` via Convex mutation.

### 7.2 Sketch → Design Generation — `POST /api/generate`
1. Client: `generateFrameSnapshot()` → blob → download link (debug) → `FormData` with image + frameNumber + projectId.
2. Server: validate, check + consume credit, load style guide + inspiration image URLs + system prompt.
3. Build user prompt: **explicit instruction to use Tailwind v4 semantic classes (`bg-background`, not `bg-white`) for light/dark compatibility**, embeds the base64 sketch image, all inspiration image URLs, and the full color/typography spec as text.
4. `streamText()` with Anthropic, image content block(s) + text prompt.
5. Convert the AI SDK stream to a raw `ReadableStream<Uint8Array>` and return as `Response` with `Content-Type: text/html`, `Connection: keep-alive`.
6. Client (`useFrame` hook): fetch with streaming reader, decode chunks, dispatch `updateShape` with the accumulating HTML string into a `generated-ui` shape (dispatched to the canvas immediately with `uiSpecData: null`, position offset from the source frame, then updated live as tokens arrive).
7. Render: `dangerouslySetInnerHTML` **after sanitizing** the HTML string (custom sanitizer — strip `<script>`, inline event handlers, etc. — flagged in code review as needing hardening against nested/obfuscated scripts).
8. A `ResizeObserver`-style polling `useEffect` on the container measures actual rendered height and grows the shape's height to fit the generated content.

### 7.3 Chat Redesign — `POST /api/generate/redesign`
- Per-generated-UI chat panel (`useChatWindow` hook) keyed by shape ID in the `chat` Redux slice.
- Sends: user's text message + current HTML (for reference) + optional wireframe snapshot + style guide + inspiration images.
- Streams back a full replacement HTML, same streaming pattern as 7.2, updates the same shape in place.

### 7.4 Workflow (multi-page) Generation — `POST /api/generate/workflow`
- Triggered from a "Generate workflow" button on a frame after its first generation.
- ⚠️ **Known limitation in source project**: page types for the N generated pages are **hardcoded** (e.g. "dashboard analytics," "settings," "user profile," "landing page") rather than derived dynamically from the first generation's content. **Recommended improvement**: have the first generation call also return a suggested list of "next pages" and feed those dynamically instead.
- For each page index: builds a prompt referencing the main page as context, positions the new generated-UI shape offset to the right of the previous one (`spacing = currentWidth + 50px`), streams independently, and `Promise.all`s the full batch — reporting success/failure counts.
- Consider running this through a background job (Inngest) instead of a blocking API route, since it's several sequential/parallel AI calls and can time out or be lost if the tab closes (flagged explicitly as a "homework" item in the source project).

### 7.5 Prompt Engineering Notes
- The single highest-leverage thing to iterate on is the system/user prompt text — the source project explicitly says the entire quality of AI output hinges on this, not the code.
- Passing **Shadcn/UI block IDs or pre-built component templates** into the prompt (rather than asking for freeform HTML every time) is called out as an unrealized but very promising enhancement — it would cut cost, increase consistency, and reduce hallucinated markup.
- Anthropic (not OpenAI) was chosen specifically for code-generation quality; note it's more expensive per call than GPT.

---

## 8. Payments & Credits (Polar + Inngest)

### 8.1 Checkout
- `GET /api/billing/checkout?userId=...` → creates a Polar checkout session (`polar.checkouts.create`) with `products: [STANDARD_PRICE_ID]`, `successUrl`, `metadata: { userId }` → redirect the browser to the returned URL.

### 8.2 Webhook → Inngest → Convex
- `POST /api/billing/webhook`:
  1. Read raw body as ArrayBuffer (Polar signs the **raw** payload — do not `JSON.parse` before verifying).
  2. `validateEvent(rawBody, headers, POLAR_WEBHOOK_SECRET)`.
  3. `inngest.send({ name: "billing/polar.webhook.received", data: { event } })`.
  4. Return 200 immediately (don't block on downstream processing).
- **Inngest function** `handlePolarEvent` (event: `billing/polar.webhook.received`):
  1. Narrow/validate the payload shape (custom type guards — `isPolarWebhookEvent`, `extractSubscription`, `extractOrder`).
  2. Resolve internal `userId`: prefer `subscription.metadata.userId`; fall back to looking up by customer email (`getUserIdByEmail` Convex query) — **normalize/trim the email** before lookup.
  3. `step.run("upsert-subscription", ...)` — upsert with **idempotency safeguards**: check for an existing subscription by both `polarSubscriptionId` AND `userId` to detect/skip duplicate or mismatched records, preserve existing `credit_balance` across upserts (don't reset it to 0 on renewal).
  4. If entitled (`active`/`trialing`) and event type is `create`/`renew`: `step.run("grant-credits", ...)` using an **idempotency key** (`hash(subscriptionId + periodEnd + eventId)`) written into the ledger to guarantee a grant only happens once even if the webhook retries.
  5. `step.sendEvent` a `billing/subscriptions.synced` event.
  6. `step.sleepUntil("wait-for-expiry", periodEnd)` then `step.run("recheck-entitlement", ...)` — re-verifies entitlement at renewal time and fires a pre-expiry event. This is the "cron-like" pattern Inngest enables without you building a scheduler.

### 8.3 Credit Consumption
- `consumeCredits` Convex mutation: validate `amount > 0`, check idempotency key against the ledger (skip if duplicate), fetch subscription, verify entitled status, verify `credit_balance >= amount`, patch balance down, insert ledger row.
- Called **after** a successful AI response is generated (not before) in most routes — except the source project's own code actually consumes credit *before* calling the AI in a couple of routes, which the transcript itself flags as a UX bug to fix (charge only after success, to avoid punishing users for AI failures).

### 8.4 Why Polar over Stripe (context, not a hard requirement)
- Chosen for: merchant-of-record tax handling, lower cross-border fees at the time, cleaner UI, and simpler API for subscription + digital product billing. Swap for Stripe/Stripe Connect/Lemon Squeezy if preferred — the Inngest webhook pattern above still applies, just change the payload parsing.

---

## 9. Autosave (Inngest)

- Client hook watches `shapes` + `viewport` Redux state, debounces (~1s) any change, `JSON.stringify`s and compares to last-saved snapshot to skip no-op saves, then `PATCH /api/project` with an `AbortController` to cancel in-flight saves on rapid edits.
- `PATCH /api/project` validates `userId`/`projectId` ownership (⚠️ flagged as **missing in the source project** — add an explicit ownership check before trusting the payload), then `inngest.send({ name: "project/autosave.requested", data: {...} })` and returns immediately.
- Inngest function `autosaveProjectWorkflow` does the actual Convex mutation (`updateProjectSketches`) — meaning even if the browser tab closes mid-save, the background job still completes and can retry automatically on failure. This is the core reason Inngest is used instead of saving directly from the API route.
- UI: a small autosave-status indicator (idle/saving/saved/error) in the navbar, driven by local component state around the debounced save call.

---

## 10. Mood Board & Inspiration Images

- Both use Convex file storage: `generateUploadUrl` mutation → client `fetch(uploadUrl, { method: "POST", body: file })` → returns `storageId` → attach to project via a mutation (`addMoodboardImage` / `addInspirationImage`) that also enforces a max count (5–6 images) and ownership checks.
- Client-side optimistic UX: local `blob:` preview URLs shown immediately while upload is in-flight, then swapped for the real server URL once uploaded (with explicit `URL.revokeObjectURL` cleanup to avoid memory leaks) — implemented via a custom `useForm` (react-hook-form, used purely as a client-state container via `watch`/`setValue`/`getValues`, not for actual field validation).
- Drag-and-drop implemented from scratch with native `dragenter/dragover/dragleave/drop` handlers — no library.
- Deletion: removes from Convex storage (`ctx.storage.delete`) and patches the project's image array.

---

## 11. UI/Route Structure

```
src/
  app/
    (auth)/
      signin/page.tsx
      signup/page.tsx
    (protected)/
      dashboard/
        page.tsx              # entitlement gate/redirect
        billing/
          [session]/page.tsx
          success/page.tsx
        [session]/
          layout.tsx           # navbar + tabs
          page.tsx             # project list
          workspace/
            layout.tsx
            canvas/
              page.tsx
              layout.tsx
            style-guide/
              page.tsx
              layout.tsx
    api/
      auth/callback/google/... (handled by Convex Auth)
      inngest/route.ts
      project/route.ts                 # PATCH autosave trigger
      billing/checkout/route.ts        # GET
      billing/webhook/route.ts         # POST
      generate/route.ts                # POST sketch->design
      generate/style/route.ts          # POST style guide
      generate/workflow/route.ts       # POST
      generate/workflow-redesign/route.ts
      generate/redesign/route.ts       # POST chat redesign
  components/
    buttons/{oauth,project,style-guide,checkout}/
    canvas/{toolbar,shapes,autosave,inspiration-sidebar,text-sidebar}/
    navbar/
    projects/{list,provider}/
    style/{theme,typography,swatch,mood-board}/
  hooks/
    use-auth.ts
    use-canvas.ts        # useInfinityCanvas, useFrame, useInspiration, useGlobalChat, useChatWindow, use-zoom helpers
    use-project.ts       # useProjectCreation
    use-styles.ts        # useStyleGuide, useMoodBoard hooks
    use-billing.ts
  redux/
    store.ts / provider.tsx
    slices/{profile,projects,shapes,viewport,chat}/index.ts
    api/{project,style-guide,billing,generation}/index.ts
  lib/
    permissions.ts       # route matchers for middleware
    utils.ts             # combineSlug, etc.
    frame-snapshot.ts    # canvas rendering + export helpers
  types/
    user.ts, polar.ts, shapes...
  convex/
    schema.ts
    users.ts, projects.ts, subscriptions.ts, moodboard.ts, inspiration.ts
    query.config.ts       # server-side preload-query helpers
  ingest/  (source project's folder name for Inngest — conventionally "inngest/")
    client.ts
    functions.ts
  middleware.ts
  prompts/
    index.ts              # all AI system/user prompt templates
```

---

## 12. Environment Variables

```
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=
CONVEX_SITE_URL=                # ngrok static domain in dev, prod domain in prod

# set via `npx convex env set`, not .env, since Convex Auth reads them server-side:
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

ANTHROPIC_API_KEY=

POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_STANDARD_PRODUCT_ID=

NEXT_PUBLIC_APP_URL=

INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

---

## 13. Suggested Build Order for Claude Code

Given the scope, feed these as **separate prompts/sessions**, each scoped narrowly, rather than one giant request:

1. **Scaffold** — Next.js + Tailwind v4 + shadcn (all components) + theme provider (forced dark) + Toaster in root layout.
2. **Convex + Auth** — schema, Convex Auth (Google + Password), middleware route matchers, sign-in/sign-up pages (Tailark or shadcn blocks), `useAuth` hook.
3. **Redux plumbing** — store/provider (SSR-safe), empty `profile`/`projects` slices, RTK Query `projectApi` scaffold, root layout preloading profile into `preloadedState`.
4. **Dashboard shell** — navbar, project list with optimistic create (Convex mutation + Redux dispatch), billing gate redirect logic.
5. **Canvas engine core** — viewport pan/zoom, shape entity slice, one shape type at a time (rectangle → ellipse → frame → free draw → line/arrow → text), hit-testing, selection overlay, resize handles. Expect this to be the longest phase — do it shape-by-shape, testing each in isolation.
6. **Mood board + style guide AI** — upload flow, then `generateObject` style guide endpoint + color/typography rendering.
7. **Inspiration images** — same upload pattern, project-scoped.
8. **Sketch→design generation** — frame snapshot canvas export, streaming API route, streamed shape rendering with sanitized HTML.
9. **Chat redesign** — per-shape chat slice + streaming redesign endpoint.
10. **Workflow generation** — multi-page batch generation (consider making page types dynamic here rather than copying the hardcoded list).
11. **Billing** — Polar checkout + webhook + Inngest subscription/credit functions, credit consumption mutation with idempotency.
12. **Autosave** — Inngest-backed autosave route + debounced client hook + status indicator.
13. **Export** — canvas-to-PNG and html-to-image export buttons.
14. **Hardening pass** — ownership checks on every mutation/route, HTML sanitizer audit, move credit consumption to *after* successful generation everywhere, dedupe subscription-lookup logic.
15. **Tests** — Jest + RTL behavior-driven tests against real (not mocked) components, aim for ~80% coverage, fix anything that surfaces.
16. **Deploy** — CI/CD pipeline with separate dev/staging/production environments and isolated env vars per environment.

---

## 14. Known Gaps / Things to Fix, Not Copy As-Is

- Missing ownership/auth checks on the autosave PATCH route (add before use).
- Credit consumption happens before the AI call succeeds in a couple of routes — move to after success.
- Workflow page types are hardcoded instead of derived dynamically.
- HTML sanitizer needs hardening against nested `<script>`/obfuscated payloads before `dangerouslySetInnerHTML`.
- Subscription upsert logic has defensive duplicate-detection code that indicates the id-resolution strategy (metadata userId vs. email fallback) should really be simplified/hardened rather than patched around.
- Frame drag-move-together and copy/paste (Ctrl+C/V) for multi-selected shapes were left as open enhancements, not implemented.
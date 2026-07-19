import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { StyleGuide } from "@/types/style-guide";

/**
 * Shared plumbing for the /api/generate/* routes: Clerk auth → Convex token,
 * project ownership loading, credit checks, and post-success credit
 * consumption. Not a route (folder is underscore-prefixed).
 */

// ── Errors → HTTP status ─────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("[api/generate] unexpected error:", error);
  return Response.json(
    { error: "Something went wrong while generating. Please try again." },
    { status: 500 }
  );
}

// ── Auth ─────────────────────────────────────────────────────

export interface AuthContext {
  userId: string;
  /** Clerk JWT minted with the "convex" template; passed to fetchQuery/fetchMutation. */
  token: string | undefined;
}

/**
 * Authenticates the request via Clerk and mints a Convex-audience JWT.
 * Convex functions resolve the user themselves via ctx.auth (see
 * convex/auth.ts getAuthUserId) — we just have to forward the token.
 */
export async function requireAuth(): Promise<AuthContext> {
  const { userId, getToken } = await auth();
  if (!userId) throw new ApiError(401, "Unauthenticated");

  // Requires a "convex" JWT template configured in the Clerk dashboard.
  // If it isn't configured yet, getToken throws — treat as "no token" so
  // dev keeps working via the temporary bypass in convex/auth.ts.
  let token: string | undefined;
  try {
    token = (await getToken({ template: "convex" })) ?? undefined;
  } catch {
    token = undefined;
  }

  return { userId, token };
}

// ── Project + credits ────────────────────────────────────────

export interface ProjectContext extends AuthContext {
  projectId: Id<"projects">;
  /** The project doc; projects.getById already enforces ownership (returns null otherwise). */
  project: NonNullable<Awaited<ReturnType<typeof loadProject>>>;
  styleGuide: StyleGuide | null;
}

async function loadProject(projectId: Id<"projects">, token: string | undefined) {
  return await fetchQuery(api.projects.getById, { projectId }, { token });
}

export function asProjectId(value: unknown): Id<"projects"> {
  if (typeof value !== "string" || value.length === 0) {
    throw new ApiError(400, "Missing or invalid projectId");
  }
  return value as Id<"projects">;
}

/**
 * Auth + ownership + credit gate shared by all generation routes:
 * 401 unauthenticated, 404 project missing/not owned, 402 no credits.
 */
export async function requireProjectWithCredits(
  rawProjectId: unknown
): Promise<ProjectContext> {
  const authCtx = await requireAuth();
  const projectId = asProjectId(rawProjectId);

  const [project, balance] = await Promise.all([
    loadProject(projectId, authCtx.token),
    fetchQuery(api.subscriptions.getCreditBalance, {}, { token: authCtx.token }),
  ]);

  if (!project) throw new ApiError(404, "Project not found");
  if (balance <= 0) {
    throw new ApiError(402, "No credits remaining. Please upgrade your plan.");
  }

  return {
    ...authCtx,
    projectId,
    project,
    styleGuide: (project.style_guide ?? null) as StyleGuide | null,
  };
}

/** Fetches inspiration image URLs for a project (empty array on none). */
export async function getInspirationUrls(
  projectId: Id<"projects">,
  token: string | undefined
): Promise<string[]> {
  const entries = await fetchQuery(
    api.inspiration.getImageUrls,
    { projectId },
    { token }
  );
  return (entries ?? [])
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .map((e) => e.url);
}

/**
 * Consumes credits AFTER a successful generation (spec §8.3 / §14: never
 * charge before the AI call succeeds). Idempotent via the ledger key, so
 * retries of the same request never double-charge.
 */
export async function consumeCreditsAfterSuccess(options: {
  token: string | undefined;
  idempotencyKey: string;
  reason: string;
  amount?: number;
}): Promise<void> {
  const { token, idempotencyKey, reason, amount = 1 } = options;
  try {
    await fetchMutation(
      api.subscriptions.consumeCredits,
      { amount, reason, idempotency_key: idempotencyKey },
      { token }
    );
  } catch (error) {
    // The user already received their generation — don't fail the response.
    // Log for reconciliation instead.
    console.error(
      `[api/generate] credit consumption failed (key=${idempotencyKey}):`,
      error
    );
  }
}

/** Stable per-request idempotency key: honors a client-sent requestId, else random. */
export function buildIdempotencyKey(
  prefix: string,
  projectId: string,
  requestId: unknown
): string {
  const id =
    typeof requestId === "string" && requestId.length > 0 && requestId.length <= 128
      ? requestId
      : crypto.randomUUID();
  return `${prefix}:${projectId}:${id}`;
}

// ── Streaming ────────────────────────────────────────────────

/**
 * Wraps an AI SDK text stream (async iterable of string chunks) into a raw
 * text/html streaming Response (spec §7.2 step 5).
 */
export function htmlStreamResponse(
  textStream: AsyncIterable<string>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

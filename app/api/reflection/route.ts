import { getCurrentSession } from "@/lib/auth/session";
import { ndjsonStream } from "@/lib/http/ndjson";
import { streamReflection } from "@/lib/reflection.service";

/**
 * Streams a retrieval-first reflection as NDJSON: one `evidence` frame (~1s),
 * then `token` frames, then `done` / `error`.
 *
 * Thin by design (CLAUDE.md > Architecture) — session check + orchestration
 * only; retrieval and generation stay in `lib/`. The client calls this with
 * `fetch` + an AbortController, so the Stop button closes the connection, which
 * aborts the Ollama fetch and stops the model. No total timeout.
 */

export const dynamic = "force-dynamic";

const NDJSON = "application/x-ndjson; charset=utf-8";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return new Response(
      `${JSON.stringify({ type: "error", error: "Please sign in again." })}\n`,
      { status: 401, headers: { "content-type": NDJSON } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    question?: unknown;
    limit?: unknown;
  };

  const stream = ndjsonStream(
    streamReflection(session.userId, body.question, request.signal, body.limit),
  );

  return new Response(stream, {
    headers: {
      "content-type": NDJSON,
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

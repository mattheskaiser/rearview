import "server-only";

import { streamAnswer } from "@/lib/ai/answer.service";
import { toEvidenceCards } from "@/lib/ai/evidence-cards";
import { ensureOllamaReady, OLLAMA_DOWN_MESSAGE } from "@/lib/ai/ollama-readiness.service";
import { OllamaUnavailableError } from "@/lib/ai/ollama.service";
import { retrieve } from "@/lib/retrieval.service";
import type { EvidenceCard, ReflectionStreamEvent } from "@/lib/types/memory";
import { questionSchema } from "@/lib/validation/memory";

/**
 * Application-logic boundary for the Memories "ask your journal" flow
 * (CLAUDE.md > Architecture). Retrieval runs first and cheaply into evidence
 * cards; the grounded answer is then streamed. The page never learns how
 * retrieval or generation work. Nothing here logs the question or the evidence.
 */

const NO_EVIDENCE =
  "No journal entries seem related to that question yet. Try rephrasing, or write more entries.";
const OLLAMA_DOWN = OLLAMA_DOWN_MESSAGE;
const GENERIC = "Something went wrong. Please try again.";

export const DEFAULT_EVIDENCE_LIMIT = 6;
export const MAX_EVIDENCE_LIMIT = 15;

/** Clamp a client-supplied evidence limit into a bounded range. */
function normalizeLimit(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_EVIDENCE_LIMIT;
  return Math.min(
    MAX_EVIDENCE_LIMIT,
    Math.max(DEFAULT_EVIDENCE_LIMIT, Math.floor(value)),
  );
}

export type RetrieveEvidenceResult =
  | { ok: true; question: string; evidence: EvidenceCard[] }
  | { ok: false; error: string };

/**
 * Retrieval only — no generation. Backs "Show more entries": a larger `limit`
 * surfaces more distinct entries. The answer is never re-triggered by this.
 */
export async function retrieveEvidence(
  userId: string,
  rawQuestion: unknown,
  rawLimit?: unknown,
): Promise<RetrieveEvidenceResult> {
  const parsed = questionSchema.safeParse(rawQuestion);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please enter a question.",
    };
  }

  const problem = await ensureOllamaReady(userId, "embedding");
  if (problem) return { ok: false, error: problem };

  try {
    const { chunks } = await retrieve(userId, parsed.data, {
      limit: normalizeLimit(rawLimit),
    });
    return { ok: true, question: parsed.data, evidence: toEvidenceCards(chunks) };
  } catch (error) {
    if (error instanceof OllamaUnavailableError) {
      return { ok: false, error: OLLAMA_DOWN };
    }
    return { ok: false, error: GENERIC };
  }
}

/**
 * Retrieval-first streamed reflection: an `evidence` frame (~1s), then answer
 * tokens, then `done`. Ends silently on `aborted` (Stop button); a stall or
 * dead Ollama yields `error`.
 */
export async function* streamReflection(
  userId: string,
  rawQuestion: unknown,
  signal?: AbortSignal,
  rawLimit?: unknown,
): AsyncGenerator<ReflectionStreamEvent> {
  const parsed = questionSchema.safeParse(rawQuestion);
  if (!parsed.success) {
    yield {
      type: "error",
      error: parsed.error.issues[0]?.message ?? "Please enter a question.",
    };
    return;
  }
  const question = parsed.data;

  const problem = await ensureOllamaReady(userId, "generation");
  if (problem) {
    yield { type: "error", error: problem };
    return;
  }

  let chunks: Awaited<ReturnType<typeof retrieve>>["chunks"];
  try {
    ({ chunks } = await retrieve(userId, question, {
      limit: normalizeLimit(rawLimit),
    }));
  } catch (error) {
    yield {
      type: "error",
      error: error instanceof OllamaUnavailableError ? OLLAMA_DOWN : GENERIC,
    };
    return;
  }

  if (chunks.length === 0) {
    yield { type: "error", error: NO_EVIDENCE };
    return;
  }

  yield { type: "evidence", evidence: toEvidenceCards(chunks) };

  const evidence = chunks.map((chunk) => ({
    journalDate: chunk.journalDate,
    text: chunk.text,
  }));

  for await (const event of streamAnswer(question, evidence, signal)) {
    if (event.type === "token") yield { type: "token", value: event.value };
    else if (event.type === "done") yield { type: "done" };
    else if (event.type === "aborted") return;
    else {
      yield {
        type: "error",
        error: event.reason === "ollama-unavailable" ? OLLAMA_DOWN : GENERIC,
      };
    }
  }
}

import "server-only";

import {
  ANSWER_SYSTEM_PROMPT,
  buildAnswerPrompt,
  type PromptEvidence,
} from "@/lib/ai/answer-prompt";
import {
  OllamaError,
  OllamaUnavailableError,
  generate,
} from "@/lib/ai/ollama.service";
import { generateStream, isAbortError } from "@/lib/ai/ollama-stream.service";

/**
 * AI answer capability (CLAUDE.md > AI). Turns retrieved journal evidence into a
 * grounded synthesis. The prompt and evidence never reach a log. A missing or
 * unreachable Ollama is a typed reason, never thrown — journal features keep
 * working when inference is down.
 */

export type AnswerFailureReason =
  | "no-evidence"
  | "ollama-unavailable"
  | "generation-failed";

export type AnswerResult =
  | { ok: true; answer: string }
  | { ok: false; reason: AnswerFailureReason };

/** One frame of a streamed answer. `aborted` means the caller stopped it. */
export type AnswerStreamEvent =
  | { type: "token"; value: string }
  | { type: "done" }
  | { type: "aborted" }
  | { type: "error"; reason: AnswerFailureReason };

/** Low temperature keeps the synthesis close to the evidence. */
const GENERATION_TEMPERATURE = 0.2;

/**
 * No total timeout on generation (a large journal may legitimately take
 * minutes). Instead: no token for this long → stalled → "AI unavailable".
 */
const STALL_TIMEOUT_MS = 60_000;

/** Non-streaming synthesis — kept for callers that just want the final text. */
export async function generateAnswer(
  question: string,
  evidence: PromptEvidence[],
): Promise<AnswerResult> {
  if (evidence.length === 0) return { ok: false, reason: "no-evidence" };

  try {
    const raw = await generate(buildAnswerPrompt(question, evidence), {
      system: ANSWER_SYSTEM_PROMPT,
      temperature: GENERATION_TEMPERATURE,
    });
    const answer = raw.trim();
    if (!answer) return { ok: false, reason: "generation-failed" };
    return { ok: true, answer };
  } catch (error) {
    if (error instanceof OllamaUnavailableError) {
      return { ok: false, reason: "ollama-unavailable" };
    }
    if (error instanceof OllamaError) {
      return { ok: false, reason: "generation-failed" };
    }
    throw error;
  }
}

/**
 * Streaming synthesis. Yields `token` frames as they arrive, then `done`;
 * `aborted` if `signal` fires (Stop button); `error` on a stall or a dead
 * Ollama. Aborting closes the fetch, which stops the model server-side.
 */
export async function* streamAnswer(
  question: string,
  evidence: PromptEvidence[],
  signal?: AbortSignal,
): AsyncGenerator<AnswerStreamEvent> {
  if (evidence.length === 0) {
    yield { type: "error", reason: "no-evidence" };
    return;
  }

  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", relayAbort, { once: true });

  const iterator = generateStream(buildAnswerPrompt(question, evidence), {
    system: ANSWER_SYSTEM_PROMPT,
    temperature: GENERATION_TEMPERATURE,
    signal: controller.signal,
  })[Symbol.asyncIterator]();

  let produced = false;
  try {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stall = new Promise<"stall">((resolve) => {
        timer = setTimeout(() => resolve("stall"), STALL_TIMEOUT_MS);
      });

      const nextToken = iterator.next();
      let step: IteratorResult<string> | "stall";
      try {
        step = await Promise.race([nextToken, stall]);
      } finally {
        clearTimeout(timer);
      }

      if (step === "stall") {
        nextToken.catch(() => {}); // the losing race branch aborts later — swallow it
        controller.abort(); // closes the fetch; the model stops server-side
        void iterator.return?.(undefined).catch(() => {});
        yield { type: "error", reason: "ollama-unavailable" };
        return;
      }
      if (step.done) {
        yield produced
          ? { type: "done" }
          : { type: "error", reason: "generation-failed" };
        return;
      }
      produced = true;
      yield { type: "token", value: step.value };
    }
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      yield { type: "aborted" };
      return;
    }
    // A streaming boundary must never re-throw: an uncaught error here would
    // reject the response stream and can crash the server process.
    yield {
      type: "error",
      reason:
        error instanceof OllamaUnavailableError
          ? "ollama-unavailable"
          : "generation-failed",
    };
  } finally {
    signal?.removeEventListener("abort", relayAbort);
  }
}

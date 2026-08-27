import "server-only";

import type { GenerateOptions } from "@/lib/ai/ollama.service";
import {
  OllamaResponseError,
  OllamaUnavailableError,
} from "@/lib/ai/ollama.service";
import { ndjsonLines } from "@/lib/http/ndjson";
import { env } from "@/lib/env";

/**
 * Streaming counterpart to `generate()` (CLAUDE.md > AI: "Generation and
 * embeddings should be treated as separate capabilities"). Same gateway rules —
 * server-only, model + base URL from `lib/env`, nothing logged.
 *
 * Deliberately has **no total timeout**: a large journal can make generation
 * take minutes and that must not fail. The caller supplies an `AbortSignal`
 * (the Stop button, or a stall watchdog) and closing it aborts the underlying
 * fetch, which tells Ollama to stop the model.
 */

export type GenerateStreamOptions = GenerateOptions & {
  /** Abort the fetch — and with it the running model — when this fires. */
  signal?: AbortSignal;
};

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Stream one completion token-by-token as text deltas. */
export async function* generateStream(
  prompt: string,
  options: GenerateStreamOptions = {},
): AsyncGenerator<string> {
  let response: Response;
  try {
    response = await fetch(new URL("/api/generate", env.OLLAMA_BASE_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_GENERATION_MODEL,
        prompt,
        system: options.system,
        stream: true,
        options:
          options.temperature === undefined
            ? undefined
            : { temperature: options.temperature },
      }),
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new OllamaUnavailableError(
      `Could not reach Ollama at ${env.OLLAMA_BASE_URL}. Is it running?`,
    );
  }

  if (!response.ok) {
    throw new OllamaResponseError(
      "Ollama request to /api/generate failed",
      response.status,
    );
  }
  if (!response.body) {
    throw new OllamaResponseError(
      "Ollama returned no response stream",
      response.status,
    );
  }

  try {
    for await (const line of ndjsonLines(response.body)) {
      let frame: { response?: unknown; done?: unknown };
      try {
        frame = JSON.parse(line);
      } catch {
        continue; // a partial line — skip it, don't kill the stream
      }
      if (typeof frame.response === "string" && frame.response.length > 0) {
        yield frame.response;
      }
      if (frame.done === true) return;
    }
  } catch (error) {
    if (isAbortError(error)) throw error; // Stop button / stall — handled upstream
    // A mid-stream transport failure (connection reset, Ollama died) — same
    // user-facing state as an unreachable Ollama, never a thrown 500.
    throw new OllamaUnavailableError("The Ollama stream ended unexpectedly.");
  }
}

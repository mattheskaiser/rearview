import { ndjsonLines } from "@/lib/http/ndjson";
import type { ReflectionStreamEvent } from "@/lib/types/memory";

/**
 * Client transport for the reflection Route Handler. POSTs the question and
 * yields each NDJSON frame as it arrives. `signal` (the Stop button) aborts the
 * fetch, which closes the connection and stops the model server-side.
 */
export async function* readReflectionStream(
  question: string,
  limit: number,
  signal: AbortSignal,
): AsyncGenerator<ReflectionStreamEvent> {
  const response = await fetch("/api/reflection", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, limit }),
    signal,
  });

  if (!response.body) {
    yield {
      type: "error",
      error: response.status === 401
        ? "Please sign in again."
        : "Something went wrong. Please try again.",
    };
    return;
  }

  for await (const line of ndjsonLines(response.body)) {
    try {
      yield JSON.parse(line) as ReflectionStreamEvent;
    } catch {
      // partial or malformed line — wait for the next one
    }
  }
}

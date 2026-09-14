import "server-only";

import { generateStream, isAbortError } from "@/lib/ai/ollama-stream.service";
import { OllamaUnavailableError, type GenerateOptions } from "@/lib/ai/ollama.service";

/**
 * `lib/ai/ollama.service`'s non-streaming `generate()` has a flat 60s total
 * timeout — fine for a short completion, wrong for a longer synthesis prompt.
 * A live check against this machine's own Ollama during development hit that
 * cap on the pattern-analysis prompt well before the model finished. The
 * single-answer path already solves this the same way (lib/ai/answer.service
 * `streamAnswer`): stream, and fail only on *silence* (no token for this
 * long), never on total elapsed time — "a large journal may legitimately
 * take minutes" applies here too. This collects the full stream into one
 * string for callers (map-reduce stages) that don't need to forward tokens
 * live to a browser.
 */

const STALL_TIMEOUT_MS = 60_000;

export async function generateCollected(
  prompt: string,
  options: GenerateOptions = {},
): Promise<string> {
  const controller = new AbortController();
  const iterator = generateStream(prompt, {
    ...options,
    signal: controller.signal,
  })[Symbol.asyncIterator]();

  let text = "";
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
        nextToken.catch(() => {});
        controller.abort();
        void iterator.return?.(undefined).catch(() => {});
        throw new OllamaUnavailableError(
          "Ollama stopped responding (no output for 60s).",
        );
      }
      if (step.done) return text;
      text += step.value;
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw new OllamaUnavailableError(
        "Ollama stopped responding (no output for 60s).",
      );
    }
    throw error;
  }
}

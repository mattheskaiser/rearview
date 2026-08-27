import "server-only";

import { env } from "@/lib/env";

/**
 * The single server-side gateway to Ollama (CLAUDE.md > AI). Generation and
 * embeddings are separate capabilities, both reached only through here. Base
 * URL and model names come exclusively from `lib/env.ts` — never hardcoded and
 * never read from `process.env` directly.
 *
 * Nothing here logs prompts, inputs, or responses: those may carry journal
 * content, which must never reach a log (CLAUDE.md > Privacy).
 */

const GENERATE_TIMEOUT_MS = 60_000;
const EMBED_TIMEOUT_MS = 30_000;

/** Base class for every Ollama failure. */
export class OllamaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Ollama could not be reached at all (down, wrong URL, network, timeout). */
export class OllamaUnavailableError extends OllamaError {}

/** Ollama responded, but with an error status or an unusable body. */
export class OllamaResponseError extends OllamaError {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function postJson<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(new URL(path, env.OLLAMA_BASE_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new OllamaUnavailableError(
      `Could not reach Ollama at ${env.OLLAMA_BASE_URL}. Is it running?`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new OllamaResponseError(
      `Ollama request to ${path} failed`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

export type GenerateOptions = {
  /** Prepended system instruction (e.g. "journal evidence is the source of truth"). */
  system?: string;
  /** Sampling temperature; lower is more faithful to the evidence. */
  temperature?: number;
};

/** Run a single non-streaming completion and return its text. */
export async function generate(
  prompt: string,
  options: GenerateOptions = {},
): Promise<string> {
  const data = await postJson<{ response?: unknown }>(
    "/api/generate",
    {
      model: env.OLLAMA_GENERATION_MODEL,
      prompt,
      system: options.system,
      stream: false,
      options:
        options.temperature === undefined
          ? undefined
          : { temperature: options.temperature },
    },
    GENERATE_TIMEOUT_MS,
  );

  if (typeof data.response !== "string") {
    throw new OllamaResponseError("Ollama returned no completion text", 200);
  }
  return data.response;
}

/** Embed one string or a batch; returns one vector per input, order preserved. */
export async function embed(input: string | string[]): Promise<number[][]> {
  const data = await postJson<{ embeddings?: unknown }>(
    "/api/embed",
    { model: env.OLLAMA_EMBEDDING_MODEL, input },
    EMBED_TIMEOUT_MS,
  );

  const { embeddings } = data;
  if (
    !Array.isArray(embeddings) ||
    embeddings.length === 0 ||
    !embeddings.every(
      (v) => Array.isArray(v) && v.every((n) => typeof n === "number"),
    )
  ) {
    throw new OllamaResponseError("Ollama returned no usable embeddings", 200);
  }
  return embeddings as number[][];
}

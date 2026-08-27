import "server-only";

import { ollamaFetch } from "@/lib/ai/ollama.service";
import { env } from "@/lib/env";

/**
 * Ollama readiness probe (CLAUDE.md > AI: "Support ... Health checking").
 *
 * Kept apart from the generate/embed hot path: this never throws, so a page or
 * action can show a useful "local AI is unavailable" state instead of failing
 * mid-request. It also reports whether the *configured* models are actually
 * pulled, which is the usual cause of a broken local setup.
 */

const HEALTH_TIMEOUT_MS = 5_000;

export type ModelStatus = { model: string; available: boolean };

export type OllamaHealth = {
  /** Ollama answered at all. */
  reachable: boolean;
  /** Configured generation model + whether it is pulled locally. */
  generation: ModelStatus;
  /** Configured embedding model + whether it is pulled locally. */
  embedding: ModelStatus;
};

/** A local model matches the configured name with or without a `:tag`. */
function hasModel(installed: string[], configured: string): boolean {
  return installed.some(
    (name) => name === configured || name.split(":")[0] === configured,
  );
}

export async function checkOllamaHealth(): Promise<OllamaHealth> {
  const generation = env.OLLAMA_GENERATION_MODEL;
  const embedding = env.EMBEDDING_MODEL;
  const down: OllamaHealth = {
    reachable: false,
    generation: { model: generation, available: false },
    embedding: { model: embedding, available: false },
  };

  try {
    const response = await ollamaFetch(
      "/api/tags",
      { method: "GET" },
      HEALTH_TIMEOUT_MS,
    );
    if (!response.ok) return down;

    const data = (await response.json()) as { models?: { name?: string }[] };
    const installed = (data.models ?? [])
      .map((m) => m.name)
      .filter((name): name is string => typeof name === "string");

    return {
      reachable: true,
      generation: { model: generation, available: hasModel(installed, generation) },
      embedding: { model: embedding, available: hasModel(installed, embedding) },
    };
  } catch {
    return down;
  }
}

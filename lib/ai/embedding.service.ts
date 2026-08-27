import "server-only";

import { embed } from "@/lib/ai/ollama.service";
import { env } from "@/lib/env";

/**
 * Embedding capability, kept separate from generation (CLAUDE.md > AI). Every
 * vector returned by Ollama is checked against the configured dimensionality
 * before it can flow toward the `vector(768)` column — a mismatch means the
 * wrong model is configured and must fail loudly, not corrupt storage.
 */

export class EmbeddingDimensionError extends Error {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(
      `Embedding has ${actual} dimensions, expected ${expected}. ` +
        `Check OLLAMA_EMBEDDING_MODEL / OLLAMA_EMBEDDING_DIMENSIONS.`,
    );
    this.name = "EmbeddingDimensionError";
  }
}

function assertDimensions(vector: number[]): number[] {
  if (vector.length !== env.OLLAMA_EMBEDDING_DIMENSIONS) {
    throw new EmbeddingDimensionError(
      env.OLLAMA_EMBEDDING_DIMENSIONS,
      vector.length,
    );
  }
  return vector;
}

/** Embed a single piece of text. */
export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embed(text);
  return assertDimensions(vector);
}

/** Embed many texts in one call; result order matches the input order. */
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const vectors = await embed(texts);
  if (vectors.length !== texts.length) {
    throw new Error(
      `Expected ${texts.length} embeddings from Ollama, received ${vectors.length}.`,
    );
  }
  return vectors.map(assertDimensions);
}

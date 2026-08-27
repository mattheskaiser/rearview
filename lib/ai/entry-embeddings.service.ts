import "server-only";

import { chunkText } from "@/lib/ai/chunking";
import { embedText } from "@/lib/ai/embedding.service";
import { env } from "@/lib/env";
import {
  deleteEntryChunks,
  getEntryChunkState,
  listUnembeddedChunks,
  replaceEntryChunks,
  setChunkEmbedding,
  type ChunkRecord,
} from "@/lib/db/chunks";

/**
 * Orchestrates chunking + embedding for one journal entry (CLAUDE.md >
 * Embeddings, Performance). Call this AFTER the entry is saved. It never
 * touches `JournalEntry`, so a failure here cannot roll back or corrupt the
 * entry — the work simply stays pending and a later call retries it.
 *
 * Invalidation is hash-driven: if the stored `sourceHash` differs from the
 * entry's current `contentHash`, existing chunks are deleted and regenerated
 * deterministically. If it matches, only chunks still missing an embedding are
 * processed.
 */

export type EntryEmbeddingInput = {
  entryId: string;
  /** Extracted plain text of the entry (never rich text / HTML). */
  contentText: string;
  /** Current `JournalEntry.contentHash`. */
  contentHash: string;
};

export type EntryEmbeddingResult = {
  status: "unchanged" | "regenerated" | "retried" | "failed";
  chunkCount: number;
  embedded: number;
  /** Non-sensitive reason string when `status` is "failed". */
  error?: string;
};

export async function syncEntryEmbeddings(
  input: EntryEmbeddingInput,
): Promise<EntryEmbeddingResult> {
  const { entryId, contentText, contentHash } = input;
  const state = await getEntryChunkState(entryId);

  const current = state.sourceHash === contentHash && state.total > 0;
  if (current && state.embedded === state.total) {
    return { status: "unchanged", chunkCount: state.total, embedded: 0 };
  }

  let pending: ChunkRecord[];
  let baseStatus: EntryEmbeddingResult["status"];

  if (current) {
    // Same revision, incomplete — resume where a previous run stopped.
    pending = await listUnembeddedChunks(entryId);
    baseStatus = "retried";
  } else {
    const chunks = chunkText(contentText);
    if (chunks.length === 0) {
      // Nothing embeddable (e.g. entry cleared): drop any stale chunks.
      if (state.total > 0) await deleteEntryChunks(entryId);
      return { status: "regenerated", chunkCount: 0, embedded: 0 };
    }
    pending = await replaceEntryChunks(
      entryId,
      contentHash,
      chunks.map((chunk) => ({ chunkIndex: chunk.index, text: chunk.text })),
    );
    baseStatus = "regenerated";
  }

  let embedded = 0;
  try {
    for (const chunk of pending) {
      const vector = await embedText(chunk.text);
      await setChunkEmbedding({
        chunkId: chunk.id,
        embedding: vector,
        model: env.OLLAMA_EMBEDDING_MODEL,
      });
      embedded += 1;
    }
  } catch (error) {
    // Entry stays saved; unembedded chunks remain and a later call retries.
    return {
      status: "failed",
      chunkCount: pending.length,
      embedded,
      error: error instanceof Error ? error.name : "unknown error",
    };
  }

  return { status: baseStatus, chunkCount: pending.length, embedded };
}

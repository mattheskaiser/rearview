import "server-only";

import { listEntriesPendingEmbeddingSync } from "@/lib/db/chunks";
import { syncEntryEmbeddings } from "@/lib/ai/entry-embeddings.service";

/**
 * Opportunistic retry for embeddings that failed at save time (CLAUDE.md >
 * Embeddings: "if an entry changes, its existing embeddings should be
 * invalidated or regenerated ... do not silently leave stale embeddings").
 *
 * `runEntryEmbeddingSync` (lib/journal.service) already swallows embedding
 * failures on save so a down Ollama can never break a journal write — but
 * nothing then retried, so an entry saved while Ollama was unreachable stayed
 * silently unsearchable forever. `syncEntryEmbeddings` is already resumable
 * (it tracks `sourceHash`/`embeddedAt` per chunk); this just calls it again
 * for whichever of the user's entries are still behind, a few at a time,
 * right before a query — no cron/queue needed for a single-user app whose
 * only real trigger for "Ollama is back" is the user asking another question.
 */

const DEFAULT_MAX_ENTRIES = 5;

export type BackfillSummary = {
  attempted: number;
  succeeded: number;
};

export async function syncPendingEmbeddingsForUser(
  userId: string,
  options: { maxEntries?: number } = {},
): Promise<BackfillSummary> {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const pending = await listEntriesPendingEmbeddingSync(userId, maxEntries);

  let succeeded = 0;
  for (const entry of pending) {
    const result = await syncEntryEmbeddings({
      entryId: entry.entryId,
      contentText: entry.contentText,
      contentHash: entry.contentHash,
    }).catch(() => null);
    // One entry's failure (e.g. Ollama died mid-backfill) must not stop the
    // rest of the query, let alone the ones after it in this batch.
    if (result && result.status !== "failed") succeeded += 1;
  }

  return { attempted: pending.length, succeeded };
}

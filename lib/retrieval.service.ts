import "server-only";

import { embedText } from "@/lib/ai/embedding.service";
import { searchChunksByEmbedding, type ChunkMatch } from "@/lib/db/chunks";
import { formatJournalDate } from "@/lib/time/journal-date";

/**
 * Retrieval capability (CLAUDE.md > Retrieval). The Memories page never learns
 * how this works: it asks a question, it gets journal evidence back. The
 * question is embedded and compared here; embeddings never leave the server.
 *
 * Ranking favours breadth. A question is usually answered better by the closest
 * chunk from several entries than by many chunks from one entry, so candidates
 * are over-fetched by similarity and then reranked for entry diversity.
 */

export type RetrievedChunk = {
  entryId: string;
  /** Parent entry's journal date, `YYYY-MM-DD`. */
  journalDate: string;
  chunkIndex: number;
  text: string;
  /** Cosine similarity in [-1, 1]; higher is closer. */
  similarity: number;
};

export type RetrievalResult = {
  chunks: RetrievedChunk[];
  /** Distinct journal dates behind the evidence, most relevant first. */
  entryDates: string[];
};

export const DEFAULT_RESULT_LIMIT = 6;
export const CANDIDATE_MULTIPLIER = 4;
export const MAX_CHUNKS_PER_ENTRY = 2;

/** Rerank similarity-ordered candidates to spread evidence across entries. */
export function rerankForDiversity(
  candidates: ChunkMatch[],
  limit: number,
  maxPerEntry: number = MAX_CHUNKS_PER_ENTRY,
): ChunkMatch[] {
  const byDistance = [...candidates].sort((a, b) => a.distance - b.distance);
  const perEntry = new Map<string, number>();
  const selected: ChunkMatch[] = [];

  const pass = (accept: (entryCount: number) => boolean) => {
    for (const chunk of byDistance) {
      if (selected.length >= limit) return;
      const count = perEntry.get(chunk.entryId) ?? 0;
      if (!accept(count) || selected.includes(chunk)) continue;
      perEntry.set(chunk.entryId, count + 1);
      selected.push(chunk);
    }
  };

  pass((count) => count === 0); // best chunk from each distinct entry first
  pass((count) => count > 0 && count < maxPerEntry); // then backfill spare slots

  return selected;
}

export async function retrieve(
  question: string,
  options: { limit?: number } = {},
): Promise<RetrievalResult> {
  const limit = options.limit ?? DEFAULT_RESULT_LIMIT;
  const embedding = await embedText(question);
  const candidates = await searchChunksByEmbedding(
    embedding,
    limit * CANDIDATE_MULTIPLIER,
  );

  const chunks = rerankForDiversity(candidates, limit).map((match) => ({
    entryId: match.entryId,
    journalDate: formatJournalDate(match.journalDate),
    chunkIndex: match.chunkIndex,
    text: match.text,
    similarity: 1 - match.distance,
  }));

  const entryDates = [...new Set(chunks.map((chunk) => chunk.journalDate))];
  return { chunks, entryDates };
}

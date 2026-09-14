import "server-only";

import { listEntryDates } from "@/lib/db/journal";
import { retrieve, type RetrievedChunk } from "@/lib/retrieval.service";
import { formatJournalDate, toJournalDate } from "@/lib/time/journal-date";

/**
 * Broad, time-diverse retrieval for pattern-analysis questions ("what themes
 * keep coming up", "has this changed over time"). A single query embedding's
 * top-k (lib/retrieval.service) clusters around the most semantically similar
 * entries — right for "tell me about X", wrong for "what patterns do you
 * notice across my whole journal", which needs the whole history represented,
 * not just its most-similar corner.
 *
 * Splits the user's actual journal date span (never hardcoded — CLAUDE.md >
 * Overview) into buckets and runs the existing `retrieve()` once per bucket,
 * reusing its per-entry diversity reranking, then merges. No new DB schema or
 * vector-search code: `searchChunksByEmbedding`'s `dateRange` already existed
 * for exactly this.
 */

const PER_BUCKET_LIMIT = 3;
const MAX_BUCKETS = 12;
const MIN_BUCKET_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BroadRetrievalResult = {
  chunks: RetrievedChunk[];
  entryDates: string[];
  bucketCount: number;
};

/** Split `[minDate, maxDate]` into up to MAX_BUCKETS roughly-equal spans. */
export function buildDateBuckets(
  minDate: string,
  maxDate: string,
): { from: string; to: string }[] {
  const min = toJournalDate(minDate).getTime();
  const max = toJournalDate(maxDate).getTime();
  const spanDays = Math.max(1, Math.round((max - min) / DAY_MS) + 1);
  const bucketCount = Math.min(
    MAX_BUCKETS,
    Math.max(1, Math.ceil(spanDays / MIN_BUCKET_DAYS)),
  );
  const bucketDays = Math.ceil(spanDays / bucketCount);

  const buckets: { from: string; to: string }[] = [];
  let cursor = min;
  while (cursor <= max) {
    const to = Math.min(max, cursor + (bucketDays - 1) * DAY_MS);
    buckets.push({
      from: formatJournalDate(new Date(cursor)),
      to: formatJournalDate(new Date(to)),
    });
    cursor = to + DAY_MS;
  }
  return buckets;
}

/** Merge per-bucket chunk lists, dropping duplicates a chunk could earn from overlap. */
function mergeChunks(batches: RetrievedChunk[][]): RetrievedChunk[] {
  const seen = new Set<string>();
  const merged: RetrievedChunk[] = [];
  for (const batch of batches) {
    for (const chunk of batch) {
      const key = `${chunk.entryId}:${chunk.chunkIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(chunk);
    }
  }
  return merged;
}

export async function retrieveBroad(
  userId: string,
  question: string,
): Promise<BroadRetrievalResult> {
  const dates = await listEntryDates(userId);
  if (dates.length === 0) return { chunks: [], entryDates: [], bucketCount: 0 };

  const buckets = buildDateBuckets(dates[0], dates[dates.length - 1]);
  const batches = await Promise.all(
    buckets.map((bucket) =>
      retrieve(userId, question, {
        limit: PER_BUCKET_LIMIT,
        dateRange: bucket,
      }).then((result) => result.chunks),
    ),
  );

  const chunks = mergeChunks(batches);
  const entryDates = [...new Set(chunks.map((chunk) => chunk.journalDate))];
  return { chunks, entryDates, bucketCount: buckets.length };
}

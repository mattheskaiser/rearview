import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

/**
 * Data access for `EntryChunk` rows and their pgvector embeddings.
 *
 * All `vector` column access is raw SQL and lives only here — Prisma models the
 * column as `Unsupported`, so it can neither write nor filter it. Everything
 * else uses ordinary Prisma. Vector concerns never leak into journal / memory /
 * goals access (CLAUDE.md > Database).
 *
 * Ownership: `EntryChunk` has no `userId` of its own — a chunk belongs to
 * whoever owns its parent `JournalEntry`. The read path (`searchChunksByEmbedding`)
 * takes the owning `userId` and joins through `JournalEntry`, so retrieval can
 * never surface another user's chunk. The write-path functions are keyed by
 * `entryId`, which the caller obtained from a user-scoped entry save.
 */

export type ChunkInput = {
  /** Zero-based order within the entry. */
  chunkIndex: number;
  text: string;
};

export type ChunkRecord = ChunkInput & { id: string };

export type ChunkEmbeddingWrite = {
  chunkId: string;
  embedding: number[];
  /** The Ollama embedding model that produced the vector. */
  model: string;
};

export type EntryChunkState = {
  /** `sourceHash` shared by this entry's chunks, or null when it has none. */
  sourceHash: string | null;
  total: number;
  embedded: number;
};

const select = { id: true, chunkIndex: true, text: true } as const;

/**
 * Replace every chunk for an entry with a fresh ordered set, all embeddings
 * pending. `sourceHash` stamps the entry revision the chunks came from.
 */
export async function replaceEntryChunks(
  entryId: string,
  sourceHash: string,
  chunks: ChunkInput[],
): Promise<ChunkRecord[]> {
  await prisma.$transaction([
    prisma.entryChunk.deleteMany({ where: { entryId } }),
    prisma.entryChunk.createMany({
      data: chunks.map((chunk) => ({
        entryId,
        sourceHash,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
      })),
    }),
  ]);

  return prisma.entryChunk.findMany({
    where: { entryId },
    orderBy: { chunkIndex: "asc" },
    select,
  });
}

/** Attach an embedding vector to a chunk (raw SQL — `vector` is Unsupported). */
export async function setChunkEmbedding(
  write: ChunkEmbeddingWrite,
): Promise<void> {
  const literal = `[${write.embedding.join(",")}]`;
  await prisma.$executeRaw`
    UPDATE "EntryChunk"
    SET "embedding" = ${literal}::vector,
        "model" = ${write.model},
        "embeddedAt" = now()
    WHERE "id" = ${write.chunkId}
  `;
}

/** Delete every chunk (and its embedding) belonging to an entry. */
export async function deleteEntryChunks(entryId: string): Promise<void> {
  await prisma.entryChunk.deleteMany({ where: { entryId } });
}

/** This entry's chunks that still have no embedding, in order. */
export function listUnembeddedChunks(entryId: string): Promise<ChunkRecord[]> {
  return prisma.entryChunk.findMany({
    where: { entryId, embeddedAt: null },
    orderBy: { chunkIndex: "asc" },
    select,
  });
}

export type ChunkMatch = {
  entryId: string;
  /** Parent entry's journal date (midnight-UTC calendar day). */
  journalDate: Date;
  chunkIndex: number;
  text: string;
  /** pgvector cosine distance to the query vector; lower is closer. */
  distance: number;
};

/** Inclusive journal-date bounds (midnight-UTC calendar days). */
export type DateRange = { from?: Date; to?: Date };

/**
 * Nearest embedded chunks to a query vector for one user, by cosine distance
 * (raw SQL — `vector` is Unsupported). The join to `JournalEntry` also enforces
 * ownership: `e."userId" = ${userId}` means a search can only ever return the
 * caller's own chunks. An optional `dateRange` narrows the search to entries
 * whose journal date falls within the given bounds. The parent entry's journal
 * date rides along so the retrieval layer can diversify across dates without a
 * second round-trip. Embeddings never leave this module.
 */
/**
 * Cap on the vector search itself. The generation stream has a stall
 * watchdog (lib/ai/answer.service); this is the equivalent guard for a hung
 * DB query, which would otherwise block a reflection request indefinitely
 * with no signal at all. `SET LOCAL` requires a transaction — it reverts
 * automatically at the end of it, so it can never leak onto a pooled
 * connection's later, unrelated queries.
 */
const SEARCH_STATEMENT_TIMEOUT_MS = 10_000;

export async function searchChunksByEmbedding(
  userId: string,
  embedding: number[],
  limit: number,
  dateRange?: DateRange,
): Promise<ChunkMatch[]> {
  if (embedding.length === 0 || limit <= 0) return [];
  const literal = `[${embedding.join(",")}]`;

  const conditions = [
    Prisma.sql`c."embedding" IS NOT NULL`,
    Prisma.sql`e."userId" = ${userId}`,
  ];
  if (dateRange?.from) {
    conditions.push(Prisma.sql`e."journalDate" >= ${dateRange.from}`);
  }
  if (dateRange?.to) {
    conditions.push(Prisma.sql`e."journalDate" <= ${dateRange.to}`);
  }

  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('statement_timeout', ${String(SEARCH_STATEMENT_TIMEOUT_MS)}, true)`;
    return tx.$queryRaw<ChunkMatch[]>(Prisma.sql`
      SELECT c."entryId"     AS "entryId",
             e."journalDate" AS "journalDate",
             c."chunkIndex"  AS "chunkIndex",
             c."text"        AS "text",
             (c."embedding" <=> ${literal}::vector) AS "distance"
      FROM "EntryChunk" c
      JOIN "JournalEntry" e ON e."id" = c."entryId"
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY "distance" ASC
      LIMIT ${limit}
    `);
  });
  return rows.map((row) => ({
    ...row,
    chunkIndex: Number(row.chunkIndex),
    distance: Number(row.distance),
  }));
}

/** Summary of an entry's chunk/embedding state, used to decide regeneration. */
export async function getEntryChunkState(
  entryId: string,
): Promise<EntryChunkState> {
  const rows = await prisma.entryChunk.findMany({
    where: { entryId },
    select: { sourceHash: true, embeddedAt: true },
  });
  return {
    sourceHash: rows[0]?.sourceHash ?? null,
    total: rows.length,
    embedded: rows.filter((row) => row.embeddedAt !== null).length,
  };
}

export type PendingEmbeddingEntry = {
  entryId: string;
  contentText: string;
  contentHash: string;
};

/**
 * Entries for `userId` that `syncEntryEmbeddings` (lib/ai/entry-embeddings.service)
 * has not finished embedding — either it has never been chunked for its
 * current revision, or some chunk from that revision is still missing an
 * embedding (e.g. Ollama was down when the entry was saved). Feeds the
 * opportunistic backfill in lib/ai/embedding-backfill.service, so a save-time
 * embedding failure gets a real retry instead of staying unsearchable
 * forever. Entries with no plain text (nothing embeddable) are excluded —
 * they can never gain a matching chunk and would otherwise show up on every
 * call.
 */
export async function listEntriesPendingEmbeddingSync(
  userId: string,
  limit: number,
): Promise<PendingEmbeddingEntry[]> {
  if (limit <= 0) return [];
  return prisma.$queryRaw<PendingEmbeddingEntry[]>`
    SELECT e."id" AS "entryId", e."contentText" AS "contentText", e."contentHash" AS "contentHash"
    FROM "JournalEntry" e
    WHERE e."userId" = ${userId}
      AND length(trim(e."contentText")) > 0
      AND (
        NOT EXISTS (
          SELECT 1 FROM "EntryChunk" c
          WHERE c."entryId" = e."id" AND c."sourceHash" = e."contentHash"
        )
        OR EXISTS (
          SELECT 1 FROM "EntryChunk" c
          WHERE c."entryId" = e."id" AND c."sourceHash" = e."contentHash" AND c."embeddedAt" IS NULL
        )
      )
    ORDER BY e."journalDate" DESC
    LIMIT ${limit}
  `;
}

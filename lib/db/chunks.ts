import "server-only";

import { prisma } from "@/lib/db/client";

/**
 * Data access for `EntryChunk` rows and their pgvector embeddings.
 *
 * All `vector` column access is raw SQL and lives only here — Prisma models the
 * column as `Unsupported`, so it can neither write nor filter it. Everything
 * else uses ordinary Prisma. Vector concerns never leak into journal / memory /
 * goals access (CLAUDE.md > Database).
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

/**
 * Nearest embedded chunks to a query vector, by cosine distance (raw SQL —
 * `vector` is Unsupported). The parent entry's journal date rides along so the
 * retrieval layer can diversify across dates without a second round-trip.
 * Embeddings never leave this module.
 */
export async function searchChunksByEmbedding(
  embedding: number[],
  limit: number,
): Promise<ChunkMatch[]> {
  if (embedding.length === 0 || limit <= 0) return [];
  const literal = `[${embedding.join(",")}]`;
  const rows = await prisma.$queryRaw<ChunkMatch[]>`
    SELECT c."entryId"     AS "entryId",
           e."journalDate" AS "journalDate",
           c."chunkIndex"  AS "chunkIndex",
           c."text"        AS "text",
           (c."embedding" <=> ${literal}::vector) AS "distance"
    FROM "EntryChunk" c
    JOIN "JournalEntry" e ON e."id" = c."entryId"
    WHERE c."embedding" IS NOT NULL
    ORDER BY "distance" ASC
    LIMIT ${limit}
  `;
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

-- Switch the embedding model to bge-m3 (multilingual, 1024-dimensional).
--
-- The previous model (nomic-embed-text / bge-m3-as-768) produced 768-dim
-- vectors; bge-m3 emits 1024. The `EntryChunk.embedding` column is a fixed-width
-- `vector(N)` type, so the dimension change is a structural migration.
--
-- Safe to drop and recreate: `EntryChunk` holds zero rows at this point, so
-- there are no embeddings to lose. If this project ever swaps embedding models
-- again with a dimension change, follow the same pattern AND re-run
-- `syncEntryEmbeddings` for every entry so the new vectors are regenerated.
--
-- The pgvector HNSW index is hand-maintained (Prisma models `vector` as
-- `Unsupported` and cannot see it), so it is dropped and recreated here too.

DROP INDEX IF EXISTS "EntryChunk_embedding_hnsw_idx";

ALTER TABLE "EntryChunk" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "EntryChunk" ADD COLUMN "embedding" vector(1024);

-- Any chunk that still carried model / embeddedAt metadata is now unembedded.
-- No-op on an empty table; correct if rows somehow exist.
UPDATE "EntryChunk" SET "model" = NULL, "embeddedAt" = NULL;

-- HNSW over cosine distance — retrieval compares bge-m3 vectors with cosine
-- similarity (see lib/db/chunks.ts `searchChunksByEmbedding`).
CREATE INDEX "EntryChunk_embedding_hnsw_idx"
    ON "EntryChunk"
    USING hnsw ("embedding" vector_cosine_ops);

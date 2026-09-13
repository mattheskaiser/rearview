-- Backups now store their full snapshot in Postgres (Backup.content) instead
-- of a local file path, so a lost/broken laptop doesn't take the backups with
-- it. The one existing row (from manual testing) held a local file path with
-- no equivalent JSON snapshot to migrate into the new column, and embedding
-- its content directly into this migration file would mean committing journal
-- content to git forever — so it is cleared here instead. This does not touch
-- any journal data: JournalEntry/Memory/CurrentGoals are untouched, and a
-- local copy from that test still exists on disk.
DELETE FROM "Backup";

-- AlterTable
ALTER TABLE "Backup" ADD COLUMN "content" JSONB NOT NULL;
ALTER TABLE "Backup" DROP COLUMN "filePath";

-- Prisma's diff doesn't know about this hand-maintained pgvector index (see
-- 20260827160000_embedding_model_bge_m3/migration.sql) and drops it whenever
-- an unrelated migration is generated; the previous migration
-- (20260912212810_add_backup_model) did exactly that. Restore it here.
CREATE INDEX "EntryChunk_embedding_hnsw_idx"
    ON "EntryChunk"
    USING hnsw ("embedding" vector_cosine_ops);

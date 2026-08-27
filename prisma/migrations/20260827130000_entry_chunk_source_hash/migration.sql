-- Track which entry revision each chunk was derived from, so an edited entry
-- deterministically regenerates its chunk set (CLAUDE.md > Embeddings). No
-- chunk rows exist before Phase 3, so the column can be added NOT NULL.

-- AlterTable
ALTER TABLE "EntryChunk" ADD COLUMN "sourceHash" TEXT NOT NULL;

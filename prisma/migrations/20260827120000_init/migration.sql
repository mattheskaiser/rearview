-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "journalDate" DATE NOT NULL,
    "content" JSONB NOT NULL,
    "contentText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryChunk" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(768),
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embeddedAt" TIMESTAMP(3),

    CONSTRAINT "EntryChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEntry" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "entryId" TEXT,
    "journalDate" DATE NOT NULL,

    CONSTRAINT "MemoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrentGoals" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "text" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrentGoals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_journalDate_key" ON "JournalEntry"("journalDate");

-- CreateIndex
CREATE INDEX "EntryChunk_entryId_idx" ON "EntryChunk"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "EntryChunk_entryId_chunkIndex_key" ON "EntryChunk"("entryId", "chunkIndex");

-- CreateIndex
CREATE INDEX "MemoryEntry_memoryId_idx" ON "MemoryEntry"("memoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryEntry_memoryId_entryId_key" ON "MemoryEntry"("memoryId", "entryId");

-- AddForeignKey
ALTER TABLE "EntryChunk" ADD CONSTRAINT "EntryChunk_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (pgvector ANN — maintained by hand; `vector` is an Unsupported type in Prisma)
-- HNSW over cosine distance. nomic-embed-text embeddings are compared with
-- cosine similarity in retrieval (Phase 3).
CREATE INDEX "EntryChunk_embedding_hnsw_idx"
    ON "EntryChunk"
    USING hnsw ("embedding" vector_cosine_ops);

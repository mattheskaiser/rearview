-- DropIndex
DROP INDEX "EntryChunk_embedding_hnsw_idx";

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "memoryCount" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Backup_userId_idx" ON "Backup"("userId");

-- AddForeignKey
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

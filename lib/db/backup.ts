import "server-only";

import type { Backup, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

/**
 * Focused data access for backup runs. The full snapshot lives in `content`
 * (Postgres/Neon) rather than a local file, so a lost or broken laptop never
 * takes the backups with it (see lib/backup.service.ts).
 */

export type BackupRecordData = {
  userId: string;
  content: Prisma.InputJsonValue;
  entryCount: number;
  memoryCount: number;
};

export function createBackupRecord(data: BackupRecordData): Promise<Backup> {
  return prisma.backup.create({ data });
}

/** Most recent backup for `userId`, or null if one has never run. */
export function getLastBackupRecord(userId: string): Promise<Backup | null> {
  return prisma.backup.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Delete all but the `keep` most recent backups for `userId`. Each snapshot
 * holds the full journal text, so history is bounded rather than kept forever.
 */
export async function pruneOldBackups(userId: string, keep: number): Promise<void> {
  const stale = await prisma.backup.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: keep,
    select: { id: true },
  });
  if (stale.length === 0) return;
  await prisma.backup.deleteMany({
    where: { id: { in: stale.map((row) => row.id) } },
  });
}

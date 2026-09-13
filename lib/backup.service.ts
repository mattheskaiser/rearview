import "server-only";

import type { Backup, Prisma } from "@prisma/client";

import {
  createBackupRecord,
  getLastBackupRecord,
  pruneOldBackups,
} from "@/lib/db/backup";
import { getGoals } from "@/lib/db/goals";
import { listAllEntriesForUser } from "@/lib/db/journal";
import { listMemories } from "@/lib/db/memory";
import { formatJournalDate } from "@/lib/time/journal-date";
import { resolveTimeZone } from "@/lib/time/timezone";

/**
 * Manual backup: a user-triggered snapshot of everything private in Rearview
 * (journal entries, saved Memories, Current Goals), stored in Postgres/Neon
 * rather than a local file — a lost or broken laptop shouldn't take the
 * backups down with it. This exists alongside Neon's own point-in-time
 * restore (the right tool for "a bad migration wiped the database") as a
 * user-controlled, visible safety net for everyday use — e.g. right after
 * writing a new entry, before trying something risky.
 *
 * Only the most recent {@link MAX_BACKUPS} snapshots per user are kept: each
 * one holds the full journal text, so history is bounded rather than growing
 * forever.
 */

const MAX_BACKUPS = 5;

export type BackupSummary = {
  createdAt: string;
  /** e.g. "Sep 12, 2026, 4:32 PM" — formatted in the host machine's timezone. */
  formattedCreatedAt: string;
  entryCount: number;
  memoryCount: number;
};

export type RunBackupResult =
  | { ok: true; summary: BackupSummary }
  | { ok: false; error: string };

const BACKUP_FAILED = "Could not create a backup. Please try again.";

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(),
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toSummary(record: Backup): BackupSummary {
  return {
    createdAt: record.createdAt.toISOString(),
    formattedCreatedAt: formatTimestamp(record.createdAt),
    entryCount: record.entryCount,
    memoryCount: record.memoryCount,
  };
}

/** The most recent backup for `userId`, or null if one has never run. */
export async function getLastBackup(userId: string): Promise<BackupSummary | null> {
  const record = await getLastBackupRecord(userId);
  return record ? toSummary(record) : null;
}

/**
 * Fetch everything private for `userId` and store it as one JSON snapshot in
 * the `Backup` table, then drop any snapshots beyond {@link MAX_BACKUPS}.
 * Read-only against journal data — a failed backup never touches it.
 */
export async function runBackup(userId: string): Promise<RunBackupResult> {
  try {
    const [entries, memories, goals] = await Promise.all([
      listAllEntriesForUser(userId),
      listMemories(userId),
      getGoals(userId),
    ]);

    const snapshot = {
      version: 1,
      entries: entries.map((entry) => ({
        journalDate: formatJournalDate(entry.journalDate),
        content: entry.content,
        contentText: entry.contentText,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
      memories: memories.map((memory) => ({
        question: memory.question,
        answer: memory.answer,
        answerDoc: memory.answerDoc,
        referencedDates: memory.entries
          .map((entry) => formatJournalDate(entry.journalDate))
          .sort(),
        createdAt: memory.createdAt.toISOString(),
      })),
      currentGoals: { content: goals.content, text: goals.text },
    };

    const record = await createBackupRecord({
      userId,
      content: snapshot as unknown as Prisma.InputJsonValue,
      entryCount: entries.length,
      memoryCount: memories.length,
    });
    await pruneOldBackups(userId, MAX_BACKUPS);

    return { ok: true, summary: toSummary(record) };
  } catch {
    // Never surface DB internals to the client.
    return { ok: false, error: BACKUP_FAILED };
  }
}

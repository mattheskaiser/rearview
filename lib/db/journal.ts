import "server-only";

import type { JournalEntry, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { formatJournalDate } from "@/lib/time/journal-date";

/**
 * Focused data access for journal entries. Thin wrappers over Prisma — no
 * validation, no hashing, no embedding logic (that lives in the application /
 * AI layers). Callers pass already-normalized values.
 *
 * Ownership (session prompt > Authorization): every function takes the owning
 * `userId` and folds it into the query. A journal entry is never reachable by
 * id alone — the authenticated user's id is always part of the condition.
 */

export type JournalEntryWriteData = {
  /** Owning user. */
  userId: string;
  /** Midnight-UTC calendar date the entry is about. */
  journalDate: Date;
  /** TipTap document JSON. */
  content: Prisma.InputJsonValue;
  /** Deterministically extracted plain text. */
  contentText: string;
  /** Fingerprint of `contentText`. */
  contentHash: string;
};

/** Upsert by (user, calendar date) — one entry per `journalDate` per user. */
export function upsertEntryByDate(
  data: JournalEntryWriteData,
): Promise<JournalEntry> {
  const { userId, journalDate, ...rest } = data;
  return prisma.journalEntry.upsert({
    where: { userId_journalDate: { userId, journalDate } },
    create: data,
    update: rest,
  });
}

/** One entry by id, scoped to its owner. */
export function getEntryById(
  id: string,
  userId: string,
): Promise<JournalEntry | null> {
  return prisma.journalEntry.findFirst({ where: { id, userId } });
}

export function getEntryByDate(
  userId: string,
  journalDate: Date,
): Promise<JournalEntry | null> {
  return prisma.journalEntry.findUnique({
    where: { userId_journalDate: { userId, journalDate } },
  });
}

/** Entries for the given calendar dates (id + date only); order not guaranteed. */
export function getEntriesByDates(
  userId: string,
  journalDates: Date[],
): Promise<{ id: string; journalDate: Date }[]> {
  if (journalDates.length === 0) return Promise.resolve([]);
  return prisma.journalEntry.findMany({
    where: { userId, journalDate: { in: journalDates } },
    select: { id: true, journalDate: true },
  });
}

/**
 * Delete one entry by (user, calendar date). Returns false when nothing
 * matched. The `EntryChunk` FK is `onDelete: Cascade`, so the entry's chunks
 * and their embeddings go with it at the database level.
 */
export async function deleteEntryByDate(
  userId: string,
  journalDate: Date,
): Promise<boolean> {
  const { count } = await prisma.journalEntry.deleteMany({
    where: { userId, journalDate },
  });
  return count > 0;
}

/**
 * Every entry for `userId` whose calendar date falls in `year` (UTC), newest
 * first — feeds the Journal browsing view. Returns the stored TipTap document
 * so the entry can be rendered with its original formatting.
 */
export function listEntriesForYear(
  userId: string,
  year: number,
): Promise<{ id: string; journalDate: Date; content: unknown }[]> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return prisma.journalEntry.findMany({
    where: { userId, journalDate: { gte: start, lt: end } },
    select: { id: true, journalDate: true, content: true },
    orderBy: { journalDate: "desc" },
  });
}

/** Every date this user has an entry, as `YYYY-MM-DD` ascending — feeds the activity map. */
export async function listEntryDates(userId: string): Promise<string[]> {
  const rows = await prisma.journalEntry.findMany({
    where: { userId },
    select: { journalDate: true },
    orderBy: { journalDate: "asc" },
  });
  return rows.map((row) => formatJournalDate(row.journalDate));
}

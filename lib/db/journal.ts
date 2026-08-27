import "server-only";

import type { JournalEntry, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { formatJournalDate } from "@/lib/time/journal-date";

/**
 * Focused data access for journal entries. Thin wrappers over Prisma — no
 * validation, no hashing, no embedding logic (that lives in the application /
 * AI layers). Callers pass already-normalized values.
 */

export type JournalEntryWriteData = {
  /** Midnight-UTC calendar date the entry is about. */
  journalDate: Date;
  /** TipTap document JSON. */
  content: Prisma.InputJsonValue;
  /** Deterministically extracted plain text. */
  contentText: string;
  /** Fingerprint of `contentText`. */
  contentHash: string;
};

export function createEntry(data: JournalEntryWriteData): Promise<JournalEntry> {
  return prisma.journalEntry.create({ data });
}

export function updateEntry(
  id: string,
  data: Partial<JournalEntryWriteData>,
): Promise<JournalEntry> {
  return prisma.journalEntry.update({ where: { id }, data });
}

/** Upsert by calendar date — one entry per `journalDate`. */
export function upsertEntryByDate(
  data: JournalEntryWriteData,
): Promise<JournalEntry> {
  const { journalDate, ...rest } = data;
  return prisma.journalEntry.upsert({
    where: { journalDate },
    create: data,
    update: rest,
  });
}

export function getEntryById(id: string): Promise<JournalEntry | null> {
  return prisma.journalEntry.findUnique({ where: { id } });
}

export function getEntryByDate(journalDate: Date): Promise<JournalEntry | null> {
  return prisma.journalEntry.findUnique({ where: { journalDate } });
}

/** Entries for the given calendar dates (id + date only); order not guaranteed. */
export function getEntriesByDates(
  journalDates: Date[],
): Promise<{ id: string; journalDate: Date }[]> {
  if (journalDates.length === 0) return Promise.resolve([]);
  return prisma.journalEntry.findMany({
    where: { journalDate: { in: journalDates } },
    select: { id: true, journalDate: true },
  });
}

/** Every date that has an entry, as `YYYY-MM-DD`, ascending — feeds the activity map. */
export async function listEntryDates(): Promise<string[]> {
  const rows = await prisma.journalEntry.findMany({
    select: { journalDate: true },
    orderBy: { journalDate: "asc" },
  });
  return rows.map((row) => formatJournalDate(row.journalDate));
}

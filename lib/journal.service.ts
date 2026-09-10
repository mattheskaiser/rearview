import "server-only";

import type { JSONContent } from "@tiptap/core";
import type { Prisma } from "@prisma/client";

import { syncEntryEmbeddings } from "@/lib/ai/entry-embeddings.service";
import {
  createJournalEntry,
  deleteEntryById,
  getEntryByDate,
  listEntriesForYear,
  listEntryDates,
  updateEntryContent,
} from "@/lib/db/journal";
import { hashContentText } from "@/lib/editor/content-hash";
import {
  formatJournalDate,
  formatJournalHeading,
  toJournalDate,
} from "@/lib/time/journal-date";
import {
  journalEntryInputSchema,
  journalEntryUpdateSchema,
} from "@/lib/validation/journal";

/**
 * Application-logic boundary for journal entries (CLAUDE.md > Architecture).
 * Route handlers / server actions call these with the authenticated `userId`;
 * they never touch Prisma or Ollama directly. Validation happens here
 * regardless of any client-side checks, and every read/write is scoped to
 * `userId` (session prompt > Authorization).
 */

/** Non-sensitive shape handed to a deferred embedding job after a save. */
export type SavedEntryForEmbedding = {
  id: string;
  contentText: string;
  contentHash: string;
};

export type SaveJournalEntryResult =
  | { ok: true; entry: { id: string; journalDate: string } }
  | { ok: false; error: string };

const SAVE_FAILED = "Could not save your entry. Please try again.";
const DATE_TAKEN =
  "You already have an entry for this date. Edit it from the Journal Archive.";

/** True when a Prisma unique-constraint violation (`P2002`) was thrown. */
function isUniqueViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Validate, fingerprint and persist a *new* journal entry for `userId`. There is
 * one entry per calendar date per user: a date that already has an entry is
 * rejected here (and again by the DB unique index) — editing happens from the
 * Journal Archive. On success `onSaved` is invoked synchronously so the caller
 * can schedule deferred embedding work; the entry is already committed by then.
 */
export async function saveJournalEntry(
  userId: string,
  input: unknown,
  onSaved?: (entry: SavedEntryForEmbedding) => void,
): Promise<SaveJournalEntryResult> {
  const parsed = journalEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check your entry.",
    };
  }

  const { journalDate, content } = parsed.data;
  const contentHash = hashContentText(content.contentText);

  try {
    if (await getEntryByDate(userId, journalDate)) {
      return { ok: false, error: DATE_TAKEN };
    }
    const entry = await createJournalEntry({
      userId,
      journalDate,
      content: content.content as Prisma.InputJsonValue,
      contentText: content.contentText,
      contentHash,
    });
    onSaved?.({
      id: entry.id,
      contentText: content.contentText,
      contentHash,
    });
    return {
      ok: true,
      entry: { id: entry.id, journalDate: formatJournalDate(entry.journalDate) },
    };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: DATE_TAKEN };
    // Never surface DB internals / connection strings to the client.
    return { ok: false, error: SAVE_FAILED };
  }
}

/**
 * Validate and apply an edit to an existing entry (Journal Archive). The
 * journal date is fixed; only the document changes. A changed `contentHash`
 * lets the deferred embedding sync invalidate and regenerate stale chunks.
 */
export async function updateJournalEntry(
  userId: string,
  input: unknown,
  onSaved?: (entry: SavedEntryForEmbedding) => void,
): Promise<SaveJournalEntryResult> {
  const parsed = journalEntryUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check your entry.",
    };
  }

  const { entryId, content } = parsed.data;
  const contentHash = hashContentText(content.contentText);

  try {
    const updated = await updateEntryContent(userId, entryId, {
      content: content.content as Prisma.InputJsonValue,
      contentText: content.contentText,
      contentHash,
    });
    if (updated === 0) {
      return { ok: false, error: "That entry no longer exists." };
    }
    onSaved?.({ id: entryId, contentText: content.contentText, contentHash });
    return { ok: true, entry: { id: entryId, journalDate: "" } };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/**
 * Fire-and-forget embedding sync for a just-saved entry. Deferred and fully
 * isolated: it never rejects, so an Ollama outage or a chunk-table error leaves
 * the saved entry untouched and the work pending for a later retry (CLAUDE.md >
 * Error Handling, Performance).
 */
export async function runEntryEmbeddingSync(
  entry: SavedEntryForEmbedding,
): Promise<void> {
  try {
    await syncEntryEmbeddings({
      entryId: entry.id,
      contentText: entry.contentText,
      contentHash: entry.contentHash,
    });
  } catch {
    // Intentionally swallowed — the entry is safe; embeddings retry later.
  }
}

/**
 * Delete `userId`'s entry `entryId`. The chunk / embedding rows are removed with
 * it by the `EntryChunk` cascade, so a deleted entry leaves no searchable
 * representation behind (session prompt > Chunking). Returns false when no such
 * entry exists for this user.
 */
export async function deleteJournalEntry(
  userId: string,
  entryId: string,
): Promise<boolean> {
  try {
    return await deleteEntryById(userId, entryId);
  } catch {
    return false;
  }
}

/**
 * Whether `userId` already has an entry on `dateStr` (`YYYY-MM-DD`). Backs the
 * Entries composer, which stays blank and blocks a second entry for a date that
 * is already written (editing is done from the Journal Archive).
 */
export async function hasJournalEntryOnDate(
  userId: string,
  dateStr: string,
): Promise<boolean> {
  return (await getEntryByDate(userId, toJournalDate(dateStr))) !== null;
}

/** One calendar year that has journal entries, with how many. */
export type JournalYearSummary = { year: number; count: number };

/** One entry prepared for the Journal browsing view. */
export type JournalEntryView = {
  id: string;
  /** `YYYY-MM-DD`. */
  journalDate: string;
  /** e.g. "Monday, August 31st 2026". */
  heading: string;
  /** The stored TipTap document, rendered with its original formatting. */
  doc: JSONContent;
};

const EMPTY_DOC: JSONContent = { type: "doc", content: [] };

/**
 * Years `userId` has written in, newest first, each with an entry count. Backs
 * the Journal Archive on the Memories page. Derived from the (cheap) list of
 * entry dates rather than a second aggregate query.
 */
export async function listJournalYears(
  userId: string,
): Promise<JournalYearSummary[]> {
  const dates = await listEntryDates(userId);
  const counts = new Map<number, number>();
  for (const date of dates) {
    const year = Number(date.slice(0, 4));
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);
}

/** `userId`'s entries for one calendar year, newest first, ready to render. */
export async function listJournalEntriesForYear(
  userId: string,
  year: number,
): Promise<JournalEntryView[]> {
  const rows = await listEntriesForYear(userId, year);
  return rows.map((row) => {
    const journalDate = formatJournalDate(row.journalDate);
    return {
      id: row.id,
      journalDate,
      heading: formatJournalHeading(journalDate),
      doc: (row.content as JSONContent | null) ?? EMPTY_DOC,
    };
  });
}

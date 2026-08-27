import "server-only";

import type { JSONContent } from "@tiptap/core";
import type { Prisma } from "@prisma/client";

import { syncEntryEmbeddings } from "@/lib/ai/entry-embeddings.service";
import { getEntryByDate, upsertEntryByDate } from "@/lib/db/journal";
import { hashContentText } from "@/lib/editor/content-hash";
import { formatJournalDate, toJournalDate } from "@/lib/time/journal-date";
import { journalEntryInputSchema } from "@/lib/validation/journal";

/**
 * Application-logic boundary for journal entries (CLAUDE.md > Architecture).
 * Route handlers / server actions call these; they never touch Prisma or Ollama
 * directly. Validation happens here regardless of any client-side checks.
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

/**
 * Validate, fingerprint and persist one journal entry (one row per
 * `journalDate`). On success `onSaved` is invoked synchronously so the caller
 * can schedule deferred embedding work; the entry is already committed by then,
 * so anything the caller does with it cannot roll the save back.
 */
export async function saveJournalEntry(
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
    const entry = await upsertEntryByDate({
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
  } catch {
    // Never surface DB internals / connection strings to the client.
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

/** TipTap document stored for `dateStr` (`YYYY-MM-DD`), or null if none. */
export async function getEntryContentForDate(
  dateStr: string,
): Promise<JSONContent | null> {
  const entry = await getEntryByDate(toJournalDate(dateStr));
  return (entry?.content as JSONContent | undefined) ?? null;
}

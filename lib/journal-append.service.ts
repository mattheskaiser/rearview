import "server-only";

import type { JSONContent } from "@tiptap/core";

import { getEntryByDate } from "@/lib/db/journal";
import {
  saveJournalEntry,
  updateJournalEntry,
  type SavedEntryForEmbedding,
} from "@/lib/journal.service";
import { toJournalDate } from "@/lib/time/journal-date";

/**
 * Write-or-append for a single journal date, used by the terminal composer.
 *
 * The web composer refuses a date that already has an entry; from the terminal
 * it is more natural to keep writing into the same day. One entry per date is
 * still preserved: a second session on the same date appends its blocks to the
 * existing document (through the normal, validated update path, so the changed
 * `contentHash` invalidates and regenerates that entry's embeddings).
 */

export type AppendResult =
  | { ok: true; mode: "created" | "appended"; entryId: string }
  | { ok: false; error: string };

export async function saveOrAppendJournalEntry(
  userId: string,
  dateStr: string,
  doc: JSONContent,
  onSaved?: (entry: SavedEntryForEmbedding) => void,
): Promise<AppendResult> {
  let existing;
  try {
    existing = await getEntryByDate(userId, toJournalDate(dateStr));
  } catch {
    return { ok: false, error: "Could not reach the journal database." };
  }

  if (!existing) {
    const result = await saveJournalEntry(
      userId,
      { journalDate: dateStr, content: doc },
      onSaved,
    );
    return result.ok
      ? { ok: true, mode: "created", entryId: result.entry.id }
      : result;
  }

  const previous = (existing.content as JSONContent | null)?.content ?? [];
  const merged: JSONContent = {
    type: "doc",
    content: [...previous, ...(doc.content ?? [])],
  };
  const result = await updateJournalEntry(
    userId,
    { entryId: existing.id, content: merged },
    onSaved,
  );
  return result.ok
    ? { ok: true, mode: "appended", entryId: existing.id }
    : result;
}

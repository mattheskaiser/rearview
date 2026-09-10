"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireUserId } from "@/lib/auth/session";
import {
  deleteJournalEntry,
  runEntryEmbeddingSync,
  updateJournalEntry,
  type SaveJournalEntryResult,
} from "@/lib/journal.service";

export type UpdateEntryInput = {
  /** Id of the entry being edited. */
  entryId: string;
  /** TipTap document JSON from the editor. */
  content: unknown;
};

export type DeleteEntryResult = { ok: true } | { ok: false; error: string };

/**
 * Edit an existing journal entry from the Journal Archive. Authenticates, then
 * validates and persists scoped to the user, then re-syncs embeddings after the
 * response so a slow Ollama never blocks the edit.
 */
export async function updateEntryAction(
  input: UpdateEntryInput,
): Promise<SaveJournalEntryResult> {
  const userId = await requireUserId();

  const result = await updateJournalEntry(userId, input, (entry) => {
    after(() => runEntryEmbeddingSync(entry));
  });

  if (result.ok) {
    revalidatePath("/overview");
    revalidatePath("/entries");
  }

  return result;
}

/** Permanently delete one of the user's journal entries (and its embeddings). */
export async function deleteEntryAction(
  entryId: unknown,
): Promise<DeleteEntryResult> {
  const userId = await requireUserId();

  if (typeof entryId !== "string" || entryId.length === 0) {
    return { ok: false, error: "Missing entry id." };
  }

  const deleted = await deleteJournalEntry(userId, entryId);
  if (!deleted) return { ok: false, error: "That entry no longer exists." };

  revalidatePath("/overview");
  revalidatePath("/entries");
  return { ok: true };
}

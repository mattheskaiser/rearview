"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireUserId } from "@/lib/auth/session";
import {
  runEntryEmbeddingSync,
  saveJournalEntry,
  type SaveJournalEntryResult,
} from "@/lib/journal.service";

export type SaveEntryInput = {
  /** `YYYY-MM-DD` calendar day the entry is about. */
  journalDate: string;
  /** TipTap document JSON from the editor. */
  content: unknown;
};

/**
 * Server action behind the Entries page. Authenticates first, then validates
 * and persists the entry for that user, then schedules embedding generation to
 * run *after* the response is sent so a slow or unavailable Ollama never delays
 * (or fails) the save.
 */
export async function saveEntryAction(
  input: SaveEntryInput,
): Promise<SaveJournalEntryResult> {
  const userId = await requireUserId();

  const result = await saveJournalEntry(userId, input, (entry) => {
    after(() => runEntryEmbeddingSync(entry));
  });

  if (result.ok) {
    revalidatePath("/entries");
    revalidatePath("/overview");
  }

  return result;
}

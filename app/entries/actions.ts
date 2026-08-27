"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

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
 * Server action behind the Entries page. Validates and persists the entry, then
 * schedules embedding generation to run *after* the response is sent so a slow
 * or unavailable Ollama never delays (or fails) the save.
 */
export async function saveEntryAction(
  input: SaveEntryInput,
): Promise<SaveJournalEntryResult> {
  const result = await saveJournalEntry(input, (entry) => {
    after(() => runEntryEmbeddingSync(entry));
  });

  if (result.ok) {
    revalidatePath("/entries");
    revalidatePath("/overview");
  }

  return result;
}

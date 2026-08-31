"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserId } from "@/lib/auth/session";
import {
  listJournalEntriesForYear,
  type JournalEntryView,
} from "@/lib/journal.service";
import {
  removeMemory,
  saveMemory,
  type DeleteResult,
  type SaveResult,
} from "@/lib/memory.service";
import {
  retrieveEvidence,
  type RetrieveEvidenceResult,
} from "@/lib/reflection.service";

/**
 * Server actions behind the Memories page. Each authenticates first, then
 * orchestrates the reflection / persistence services scoped to the caller. The
 * streamed answer itself goes through the `app/api/reflection` Route Handler —
 * a token feed is cleaner over `fetch` + AbortController than a Server Action.
 */

/**
 * Retrieval only — no generation. Backs "Show more entries": a larger `limit`
 * surfaces more distinct entries without re-triggering the answer.
 */
export async function retrieveEvidenceAction(
  question: unknown,
  limit?: unknown,
): Promise<RetrieveEvidenceResult> {
  const userId = await requireUserId();
  return retrieveEvidence(userId, question, limit);
}

export type SaveMemoryActionInput = {
  question: string;
  answer: string;
  /** `YYYY-MM-DD` journal dates the answer cited. */
  dates: string[];
};

export async function saveMemoryAction(
  input: SaveMemoryActionInput,
): Promise<SaveResult> {
  const userId = await requireUserId();
  const result = await saveMemory(userId, input);
  if (result.ok) revalidatePath("/memories");
  return result;
}

export async function deleteMemoryAction(id: unknown): Promise<DeleteResult> {
  const userId = await requireUserId();
  const result = await removeMemory(userId, id);
  if (result.ok) revalidatePath("/memories");
  return result;
}

const yearSchema = z.coerce.number().int().gte(1900).lte(9999);

export type ListYearEntriesResult =
  | { ok: true; entries: JournalEntryView[] }
  | { ok: false; error: string };

/**
 * Journal entries for one calendar year, for the Journal browsing tab. Reads
 * are scoped to the authenticated user; the year is validated server-side.
 */
export async function listJournalEntriesForYearAction(
  year: unknown,
): Promise<ListYearEntriesResult> {
  const userId = await requireUserId();
  const parsed = yearSchema.safeParse(year);
  if (!parsed.success) return { ok: false, error: "Pick a valid year." };
  try {
    const entries = await listJournalEntriesForYear(userId, parsed.data);
    return { ok: true, entries };
  } catch {
    return { ok: false, error: "Could not load those entries. Please try again." };
  }
}

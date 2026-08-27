import "server-only";

import {
  createMemory,
  deleteMemory,
  listMemories,
  type MemoryWithEntries,
} from "@/lib/db/memory";
import { getEntriesByDates } from "@/lib/db/journal";
import {
  formatJournalDate,
  formatJournalDateLabel,
} from "@/lib/time/journal-date";
import type { Evidence, SavedMemory } from "@/lib/types/memory";
import { memoryIdSchema, saveMemoryInputSchema } from "@/lib/validation/memory";

/**
 * Persistence boundary for saved Memories (CLAUDE.md > Architecture, Memories).
 * The ask → answer flow that produces a reflection lives in
 * `lib/reflection.service.ts`; this module only turns a finished (or stopped)
 * reflection into a durable snapshot and reads them back. Nothing here logs the
 * question, the evidence, or the answer.
 */

type Fail = { ok: false; error: string };

export type SaveResult = { ok: true; memory: SavedMemory } | Fail;
export type DeleteResult = { ok: true } | Fail;

const GENERIC = "Something went wrong. Please try again.";

const toEvidence = (dates: string[]): Evidence[] =>
  dates.map((date) => ({ date, label: formatJournalDateLabel(date) }));

/** Persist a reflection as a Memory for `userId` — a dated snapshot, not a live view. */
export async function saveMemory(
  userId: string,
  rawInput: unknown,
): Promise<SaveResult> {
  const parsed = saveMemoryInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That memory could not be saved.",
    };
  }
  const { question, answer } = parsed.data;
  const dates = [
    ...new Map(parsed.data.dates.map((date) => [date.getTime(), date])).values(),
  ];

  try {
    const entries = await getEntriesByDates(userId, dates);
    const idByDate = new Map(
      entries.map((entry) => [entry.journalDate.getTime(), entry.id]),
    );
    const memory = await createMemory({
      userId,
      question,
      answer,
      entries: dates.map((date) => ({
        entryId: idByDate.get(date.getTime()) ?? null,
        journalDate: date,
      })),
    });
    return { ok: true, memory: toSavedMemory(memory) };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

export async function listSavedMemories(userId: string): Promise<SavedMemory[]> {
  const memories = await listMemories(userId);
  return memories.map(toSavedMemory);
}

export async function removeMemory(
  userId: string,
  rawId: unknown,
): Promise<DeleteResult> {
  const parsed = memoryIdSchema.safeParse(rawId);
  if (!parsed.success) return { ok: false, error: "That memory could not be found." };
  try {
    const deleted = await deleteMemory(parsed.data, userId);
    if (!deleted) return { ok: false, error: "That memory could not be found." };
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

function toSavedMemory(memory: MemoryWithEntries): SavedMemory {
  const dates = memory.entries
    .map((entry) => formatJournalDate(entry.journalDate))
    .sort();
  return {
    id: memory.id,
    question: memory.question,
    answer: memory.answer,
    evidence: toEvidence(dates),
    savedAt: memory.createdAt.toISOString(),
  };
}

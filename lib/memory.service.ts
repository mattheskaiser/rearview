import "server-only";

import { generateAnswer } from "@/lib/ai/answer.service";
import { OllamaUnavailableError } from "@/lib/ai/ollama.service";
import {
  createMemory,
  deleteMemory,
  listMemories,
  type MemoryWithEntries,
} from "@/lib/db/memory";
import { getEntriesByDates } from "@/lib/db/journal";
import { retrieve } from "@/lib/retrieval.service";
import {
  formatJournalDate,
  formatJournalDateLabel,
} from "@/lib/time/journal-date";
import type { Evidence, Reflection, SavedMemory } from "@/lib/types/memory";
import {
  memoryIdSchema,
  questionSchema,
  saveMemoryInputSchema,
} from "@/lib/validation/memory";

/**
 * Application-logic boundary for Memories (CLAUDE.md > Architecture, Memories).
 * Server actions call these; retrieval, AI and persistence stay behind their
 * own services. Nothing here logs the question, the evidence, or the answer.
 */

type Fail = { ok: false; error: string };

export type AskResult = { ok: true; reflection: Reflection } | Fail;
export type SaveResult = { ok: true; memory: SavedMemory } | Fail;
export type DeleteResult = { ok: true } | Fail;

const NO_EVIDENCE =
  "No journal entries seem related to that question yet. Try rephrasing, or write more entries.";
const OLLAMA_DOWN =
  "The local AI model is not reachable right now. Your journal is unaffected — start Ollama and try again.";
const GENERIC = "Something went wrong. Please try again.";

const toEvidence = (dates: string[]): Evidence[] =>
  dates.map((date) => ({ date, label: formatJournalDateLabel(date) }));

/** Retrieve journal evidence for a question and synthesize an answer. Persists nothing. */
export async function askJournal(rawQuestion: unknown): Promise<AskResult> {
  const parsed = questionSchema.safeParse(rawQuestion);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please enter a question.",
    };
  }
  const question = parsed.data;

  try {
    const { chunks, entryDates } = await retrieve(question);
    if (chunks.length === 0) return { ok: false, error: NO_EVIDENCE };

    const result = await generateAnswer(
      question,
      chunks.map((chunk) => ({
        journalDate: chunk.journalDate,
        text: chunk.text,
      })),
    );
    if (!result.ok) {
      return {
        ok: false,
        error: result.reason === "ollama-unavailable" ? OLLAMA_DOWN : GENERIC,
      };
    }

    return {
      ok: true,
      reflection: {
        question,
        answer: result.answer,
        evidence: toEvidence(entryDates),
      },
    };
  } catch (error) {
    if (error instanceof OllamaUnavailableError) {
      return { ok: false, error: OLLAMA_DOWN };
    }
    return { ok: false, error: GENERIC };
  }
}

/** Persist a reflection as a Memory — a dated snapshot, not a live view. */
export async function saveMemory(rawInput: unknown): Promise<SaveResult> {
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
    const entries = await getEntriesByDates(dates);
    const idByDate = new Map(
      entries.map((entry) => [entry.journalDate.getTime(), entry.id]),
    );
    const memory = await createMemory({
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

export async function listSavedMemories(): Promise<SavedMemory[]> {
  const memories = await listMemories();
  return memories.map(toSavedMemory);
}

export async function removeMemory(rawId: unknown): Promise<DeleteResult> {
  const parsed = memoryIdSchema.safeParse(rawId);
  if (!parsed.success) return { ok: false, error: "That memory could not be found." };
  try {
    await deleteMemory(parsed.data);
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

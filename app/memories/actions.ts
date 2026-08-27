"use server";

import { revalidatePath } from "next/cache";

import {
  askJournal,
  removeMemory,
  saveMemory,
  type AskResult,
  type DeleteResult,
  type SaveResult,
} from "@/lib/memory.service";

/**
 * Server actions behind the Memories page. They orchestrate the retrieval / AI
 * / persistence services and return plain results — no journal content or
 * embeddings cross to the client beyond the synthesized answer and its dates.
 */

/** Retrieve evidence and synthesize an answer. Persists nothing. */
export async function askAction(question: unknown): Promise<AskResult> {
  return askJournal(question);
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
  const result = await saveMemory(input);
  if (result.ok) revalidatePath("/memories");
  return result;
}

export async function deleteMemoryAction(id: unknown): Promise<DeleteResult> {
  const result = await removeMemory(id);
  if (result.ok) revalidatePath("/memories");
  return result;
}

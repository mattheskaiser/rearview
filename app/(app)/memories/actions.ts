"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/auth/session";
import {
  askJournal,
  removeMemory,
  saveMemory,
  type AskResult,
  type DeleteResult,
  type SaveResult,
} from "@/lib/memory.service";

/**
 * Server actions behind the Memories page. Each authenticates first, then
 * orchestrates the retrieval / AI / persistence services scoped to the caller —
 * no journal content or embeddings cross to the client beyond the synthesized
 * answer and its dates.
 */

/** Retrieve the caller's journal evidence and synthesize an answer. Persists nothing. */
export async function askAction(question: unknown): Promise<AskResult> {
  const userId = await requireUserId();
  return askJournal(userId, question);
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

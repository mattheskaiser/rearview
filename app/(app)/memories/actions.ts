"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/auth/session";
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

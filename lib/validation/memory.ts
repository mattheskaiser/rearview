import { z } from "zod";

import { journalDateSchema } from "@/lib/validation/journal";

/**
 * Server-side validation boundary for Memory operations (CLAUDE.md > Memories).
 * A Memory preserves the question, the generated answer, and the journal
 * entries it referenced.
 */

export const MAX_QUESTION_LENGTH = 500;
export const MAX_ANSWER_LENGTH = 20_000;

export const questionSchema = z
  .string()
  .trim()
  .min(1, "Question cannot be empty")
  .max(MAX_QUESTION_LENGTH, `Question is too long (max ${MAX_QUESTION_LENGTH} characters)`);

/** One referenced entry: its id plus a snapshot of its journal date. */
export const memoryEntryRefSchema = z.object({
  entryId: z.string().min(1),
  journalDate: journalDateSchema,
});

export const answerSchema = z
  .string()
  .trim()
  .min(1, "Answer cannot be empty")
  .max(MAX_ANSWER_LENGTH, `Answer is too long (max ${MAX_ANSWER_LENGTH} characters)`);

export const memoryCreateSchema = z.object({
  question: questionSchema,
  answer: answerSchema,
  entries: z.array(memoryEntryRefSchema).default([]),
});

export type MemoryCreateInput = z.infer<typeof memoryCreateSchema>;

/**
 * Input to the save-Memory boundary. The client only knows the dates its
 * reflection cited; the server resolves those to entries at save time.
 */
export const saveMemoryInputSchema = z.object({
  question: questionSchema,
  answer: answerSchema,
  dates: z.array(journalDateSchema).max(50).default([]),
});

export type SaveMemoryInput = z.infer<typeof saveMemoryInputSchema>;

export const memoryIdSchema = z.string().min(1, "Memory id is required");

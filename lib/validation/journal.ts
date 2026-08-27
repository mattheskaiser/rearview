import { z } from "zod";

import { extractPlainText } from "@/lib/editor/extract-text";
import { isFutureJournalDate, toJournalDate } from "@/lib/time/journal-date";
import { tiptapDocSchema } from "@/lib/validation/tiptap";

/**
 * Server-side validation boundary for journal entries. Client validation is
 * assumed insufficient (CLAUDE.md > Validation).
 */

export const MAX_CONTENT_TEXT_LENGTH = 100_000;

/** A `YYYY-MM-DD` string or Date, normalized to a midnight-UTC calendar date, rejected if in the future. */
export const journalDateSchema = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    try {
      return toJournalDate(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid journal date",
      });
      return z.NEVER;
    }
  })
  .refine((date) => !isFutureJournalDate(date), {
    message: "Journal date cannot be in the future",
  });

/** The rich-text document plus its extracted plain text; rejects empty entries. */
export const journalContentSchema = tiptapDocSchema
  .transform((doc) => ({ content: doc, contentText: extractPlainText(doc) }))
  .refine((v) => v.contentText.trim().length > 0, {
    message: "Journal entry cannot be empty",
  })
  .refine((v) => v.contentText.length <= MAX_CONTENT_TEXT_LENGTH, {
    message: `Journal entry is too long (max ${MAX_CONTENT_TEXT_LENGTH} characters)`,
  });

export const journalEntryInputSchema = z.object({
  journalDate: journalDateSchema,
  content: journalContentSchema,
});

export type JournalEntryInput = z.infer<typeof journalEntryInputSchema>;

/** Throws if the document has no meaningful plain text. */
export function assertNonEmptyPlainText(text: string): void {
  if (text.trim().length === 0) {
    throw new Error("Journal entry has no text content");
  }
}

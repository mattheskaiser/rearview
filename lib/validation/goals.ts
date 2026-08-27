import { z } from "zod";

import { extractPlainText } from "@/lib/editor/extract-text";
import { tiptapDocSchema } from "@/lib/validation/tiptap";

/**
 * Server-side validation boundary for Current Goals. Intentionally lightweight
 * (CLAUDE.md > Current Goals): a single rich-text field, empty allowed. Goals
 * share the journal editor, so the payload is a TipTap document; the extracted
 * plain text is derived here, never trusted from the client.
 */

export const MAX_GOALS_LENGTH = 2_000;

/** A TipTap document plus its extracted plain text. Empty is allowed. */
export const goalsContentSchema = tiptapDocSchema
  .transform((doc) => ({ content: doc, text: extractPlainText(doc) }))
  .refine((v) => v.text.length <= MAX_GOALS_LENGTH, {
    message: `Goals text is too long (max ${MAX_GOALS_LENGTH} characters)`,
  });

export const goalsUpdateSchema = z.object({
  content: goalsContentSchema,
});

export type GoalsUpdateInput = z.infer<typeof goalsUpdateSchema>;

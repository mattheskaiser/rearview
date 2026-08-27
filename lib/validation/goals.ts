import { z } from "zod";

/**
 * Server-side validation boundary for Current Goals. Intentionally lightweight
 * (CLAUDE.md > Current Goals) — a single free-text field, empty allowed.
 */

export const MAX_GOALS_LENGTH = 2_000;

export const goalsTextSchema = z
  .string()
  .max(MAX_GOALS_LENGTH, `Goals text is too long (max ${MAX_GOALS_LENGTH} characters)`);

export const goalsUpdateSchema = z.object({
  text: goalsTextSchema,
});

export type GoalsUpdateInput = z.infer<typeof goalsUpdateSchema>;

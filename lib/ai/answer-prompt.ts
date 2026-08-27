/**
 * Pure prompt construction for journal-grounded answers (CLAUDE.md > AI). No
 * DB, no Ollama, no clock — the same inputs always build the same prompt.
 *
 * The retrieved journal excerpts are presented as the only source of truth and
 * the model is told, both in the system prompt and inline, not to invent
 * anything beyond them and to admit uncertainty when they fall short.
 */

export type PromptEvidence = {
  /** `YYYY-MM-DD` journal date of the entry the excerpt came from. */
  journalDate: string;
  text: string;
};

export const ANSWER_SYSTEM_PROMPT = [
  "You are Rearview, a reflection assistant for a private personal journal.",
  "The journal excerpts included in the prompt are the only source of truth.",
  "Answer strictly from those excerpts.",
  "Never invent events, dates, feelings, or facts that are not present in them.",
  "Refer to entries by their dates where it helps.",
  "If the excerpts do not contain enough to answer confidently, say so plainly",
  "and describe what is missing instead of guessing.",
  "Keep the answer concise and grounded.",
].join(" ");

export function buildAnswerPrompt(
  question: string,
  evidence: PromptEvidence[],
): string {
  const excerpts = evidence
    .map(
      (item, index) =>
        `[${index + 1}] Journal entry — ${item.journalDate}\n${item.text}`,
    )
    .join("\n\n");

  return [
    "Journal excerpts (the only source of truth):",
    "",
    excerpts,
    "",
    "----",
    `Question: ${question}`,
    "",
    "Answer using only the excerpts above. If they are insufficient, say what is missing rather than guessing.",
  ].join("\n");
}

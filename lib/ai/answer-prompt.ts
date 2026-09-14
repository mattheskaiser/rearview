/**
 * Pure prompt construction for journal-grounded answers (CLAUDE.md > AI). No
 * DB, no Ollama, no clock — the same inputs always build the same prompt.
 *
 * The retrieved journal excerpts are presented as the only source of truth
 * about what happened, and the model is told, both in the system prompt and
 * inline, not to invent anything beyond them and to admit uncertainty when
 * they fall short. Within that grounding it may still connect entries and
 * offer its own read — clearly marked as such, never as a reported fact.
 */

export type PromptEvidence = {
  /** `YYYY-MM-DD` journal date of the entry the excerpt came from. */
  journalDate: string;
  text: string;
};

/**
 * `userName` personalizes the voice (talking to the person by name, in
 * second person) so answers don't default to a clinical "the writer"/"the
 * excerpts" register. Optional so the prompt still degrades gracefully if a
 * name is ever unavailable.
 */
export function buildAnswerSystemPrompt(userName?: string): string {
  const name = userName?.trim();
  const intro = name
    ? `You are Rearview, ${name}'s private reflection assistant. You're talking directly to ${name} about their own journal.`
    : "You are Rearview, a private reflection assistant talking directly to the person whose journal this is.";

  return [
    intro,
    'Always speak to them as "you" — never as "the writer", "the user", or in the third person — and don\'t talk about "the excerpts" as some abstract source; just refer naturally to what they wrote.',
    "What they wrote is the only source of truth about what actually happened. Never invent events, dates, feelings, or facts that aren't in it.",
    "Within that, you can connect entries and offer a genuine observation or grounded thought when it's clearly supported — just make clear when it's your own read, not a fact from the journal.",
    'When you point to something specific, quote a short phrase in their own words and say roughly when, in plain language (e.g. "back in March you wrote \'...\'"). Never say "excerpt [2]" or refer to entries by number — that numbering is only there to help you keep track, not something to repeat back.',
    "If a question has several parts (like different time periods) and some parts have solid evidence while others are thin, say so once for the thin parts and move on — don't repeat the same disclaimer after every part, and don't let a weak part drag down how confidently you state the strong ones.",
    "If what they wrote doesn't give you enough to answer confidently at all, say so plainly and describe what's missing instead of guessing.",
    "Keep the answer concise, warm, and grounded — never clinical or detached.",
  ].join(" ");
}

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
    "What you wrote (the only source of truth):",
    "",
    excerpts,
    "",
    "----",
    `Question: ${question}`,
    "",
    "Answer from what's above — you can draw a connection across entries if it genuinely helps, but don't go beyond what they show. If they're insufficient, say what's missing rather than guessing.",
  ].join("\n");
}

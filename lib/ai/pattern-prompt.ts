/**
 * Pure prompt construction for pattern-analysis questions ("what patterns do
 * you notice", "has this changed over time") — no DB, no Ollama, no clock.
 * Distinct from lib/ai/answer-prompt.ts (single grounded answer): this asks
 * the model to synthesize *across* excerpts rather than answer from them, and
 * requires a specific, parseable shape so every claim can be checked against
 * the evidence that was actually retrieved (lib/ai/parse-pattern-response.ts).
 */

export type PatternEvidence = {
  /** `YYYY-MM-DD` journal date, or a bucket label like "2025-01–2025-03" for
   * a map-stage extraction summary standing in as evidence for the reduce
   * stage. */
  journalDate: string;
  text: string;
};

/**
 * `userName` personalizes the voice the same way `answer-prompt.ts` does —
 * talking directly to the person by name, in second person, instead of
 * defaulting to a clinical "the writer"/"the excerpts" register.
 */
export function buildPatternSystemPrompt(userName?: string): string {
  const name = userName?.trim();
  const intro = name
    ? `You are Rearview, ${name}'s private reflection assistant.`
    : "You are Rearview, a private reflection assistant talking directly to the person whose journal this is.";

  return [
    intro,
    "You look across several of their journal entries to notice recurring patterns — not to answer a single factual question.",
    'Talk to them directly as "you" — never as "the writer" or in the third person.',
    "Ground every observation in what they actually wrote. Never invent one.",
    'When you point to what supports a pattern, quote a short phrase in their own words plus roughly when — never say "excerpt [1]" or refer to entries by number; that numbering is only there to help you keep track.',
    'Describe only what the writing shows: say "I noticed this recurring pattern in what you\'ve written", never a diagnostic or clinical claim about them as a person.',
    "For each pattern you're confident in, you can also offer one grounded, practical thought — something they might try or consider — but only when the entries genuinely support it, and always framed as your own suggestion, not a fact or a directive.",
    "If the entries don't support a clear pattern, say so plainly instead of inventing one.",
  ].join(" ");
}

function formatExcerpts(evidence: PatternEvidence[]): string {
  return evidence
    .map((item, index) => `[${index + 1}] ${item.journalDate}\n${item.text}`)
    .join("\n\n");
}

/**
 * Full synthesis prompt — used both for a single-pass analysis and for the
 * final "reduce" pass over map-stage extraction summaries. Requires a fixed,
 * line-based format (not JSON: more forgiving for a local model to produce
 * reliably, and still simple to parse deterministically).
 */
export function buildPatternPrompt(
  question: string,
  evidence: PatternEvidence[],
): string {
  return [
    "What you wrote (the only source of truth):",
    "",
    formatExcerpts(evidence),
    "",
    "----",
    `Question: ${question}`,
    "",
    "Respond with 1-4 observations, only as many as what you wrote actually",
    "support. For each one, write exactly these six lines:",
    "OBSERVATION: <one clear sentence describing the pattern, spoken to them as \"you\">",
    "WHY: <a short quoted phrase or two in their own words, plus roughly when, that shows this — never \"excerpt [1]\" or an entry number>",
    "DATES: <comma-separated YYYY-MM-DD dates from above that support this>",
    "COUNTEREXAMPLES: <a specific date/entry that complicates the pattern, or \"None noted\">",
    "CONFIDENCE: strong | limited | single-instance",
    "SUGGESTION: <one grounded, practical thought they might try or consider, spoken to them as \"you\", or \"None\" if you don't have one that's genuinely earned by the evidence>",
    "Separate observations with a line containing only ---.",
    "After the last observation, add a line FOLLOWUPS: then 1-3 short",
    "follow-up questions the person could explore, each on its own line",
    "starting with \"- \".",
    "If what you wrote doesn't support any clear pattern, respond with exactly:",
    "NO_PATTERN: <one sentence on what's missing>",
    "and nothing else.",
  ].join("\n");
}

/**
 * Map-stage prompt: compress one batch of raw excerpts into a short,
 * date-tagged list of candidate recurring observations. Deliberately looser
 * than the final format — this output becomes one pseudo-evidence entry fed
 * into buildPatternPrompt for the reduce pass, not a user-facing answer.
 */
export function buildExtractionPrompt(evidence: PatternEvidence[]): string {
  return [
    "Journal excerpts:",
    "",
    formatExcerpts(evidence),
    "",
    "----",
    "List, in 3-8 short bullet lines, any recurring behaviors, moods,",
    "phrases, or reactions you notice across these excerpts. End each bullet",
    "with the supporting dates in parentheses, e.g.",
    "\"- avoids conflict by changing the subject (2025-02-03, 2025-04-11)\".",
    "If nothing recurs, write exactly: Nothing notable.",
    "Do not answer any question and do not add commentary — only the list.",
  ].join("\n");
}

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

export const PATTERN_SYSTEM_PROMPT = [
  "You are Rearview, a reflection assistant for a private personal journal.",
  "You look across several journal excerpts to notice recurring patterns —",
  "not to answer a single factual question.",
  "Ground every observation in the excerpts. Never invent one.",
  "Describe only what the writing shows: say \"I noticed this recurring",
  "pattern in your writing\", never a diagnostic or clinical claim about the",
  "person. If the excerpts don't support a clear pattern, say so plainly",
  "instead of inventing one.",
].join(" ");

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
    "Journal excerpts (the only source of truth):",
    "",
    formatExcerpts(evidence),
    "",
    "----",
    `Question: ${question}`,
    "",
    "Respond with 1-4 observations, only as many as the excerpts actually",
    "support. For each one, write exactly these five lines:",
    "OBSERVATION: <one clear sentence describing the pattern>",
    "WHY: <what in the excerpts suggests this, naming specific excerpts>",
    "DATES: <comma-separated YYYY-MM-DD dates from the excerpts above that support this>",
    "COUNTEREXAMPLES: <a specific date/excerpt that complicates the pattern, or \"None noted\">",
    "CONFIDENCE: strong | limited | single-instance",
    "Separate observations with a line containing only ---.",
    "After the last observation, add a line FOLLOWUPS: then 1-3 short",
    "follow-up questions the person could explore, each on its own line",
    "starting with \"- \".",
    "If the excerpts don't support any clear pattern, respond with exactly:",
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

/**
 * Pure parser for the line-based format `pattern-prompt.ts` asks the model
 * for. No DB, no Ollama, no clock.
 *
 * Grounding verification lives here: `validDates` is the set of journal
 * dates actually present in the evidence that was retrieved. Any date the
 * model cites that isn't in that set is dropped rather than trusted — "I
 * should be able to see the entries that led to that conclusion" has to be
 * true, not just claimed. An observation left with no verifiable date after
 * that filter is dropped entirely: an unverifiable claim is exactly the
 * "unsupported claim" this feature must not produce.
 */

export type Confidence = "strong" | "limited" | "single-instance";

export type PatternObservation = {
  observation: string;
  why: string;
  supportingDates: string[];
  counterexamples: string | null;
  confidence: Confidence;
};

export type PatternAnalysisResult = {
  observations: PatternObservation[];
  followUps: string[];
};

const CONFIDENCE_VALUES: readonly Confidence[] = [
  "strong",
  "limited",
  "single-instance",
];

function matchField(block: string, field: string): string | null {
  const match = block.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function parseFollowUps(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);
}

function parseObservationBlock(
  block: string,
  validDates: ReadonlySet<string>,
): PatternObservation | null {
  const observation = matchField(block, "OBSERVATION");
  if (!observation) return null;

  const datesRaw = matchField(block, "DATES") ?? "";
  const supportingDates = datesRaw
    .split(",")
    .map((date) => date.trim())
    .filter((date) => validDates.has(date));
  if (supportingDates.length === 0) return null;

  const counterRaw = matchField(block, "COUNTEREXAMPLES");
  const counterexamples =
    counterRaw && !/^none noted\.?$/i.test(counterRaw) ? counterRaw : null;

  const confidenceRaw = matchField(block, "CONFIDENCE") ?? "";
  const confidence = (
    CONFIDENCE_VALUES as readonly string[]
  ).includes(confidenceRaw)
    ? (confidenceRaw as Confidence)
    : "limited";

  return {
    observation,
    why: matchField(block, "WHY") ?? "",
    supportingDates,
    counterexamples,
    confidence,
  };
}

export function parsePatternResponse(
  raw: string,
  validDates: ReadonlySet<string>,
): PatternAnalysisResult {
  const trimmed = raw.trim();
  if (/^NO_PATTERN:/i.test(trimmed)) return { observations: [], followUps: [] };

  const followUpsMatch = trimmed.match(/^FOLLOWUPS:\s*$/m);
  const body = followUpsMatch
    ? trimmed.slice(0, followUpsMatch.index)
    : trimmed;
  const followUps = followUpsMatch
    ? parseFollowUps(trimmed.slice(followUpsMatch.index! + followUpsMatch[0].length))
    : [];

  const observations = body
    .split(/^---$/m)
    .map((block) => parseObservationBlock(block, validDates))
    .filter((item): item is PatternObservation => item !== null);

  return { observations, followUps };
}

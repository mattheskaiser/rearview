import type { PatternAnalysisResult } from "@/lib/ai/parse-pattern-response";

/**
 * Pure formatting from a structured pattern-analysis result to the markdown
 * string a saved Memory's `answer` field expects (lib/memory.service converts
 * it to `answerDoc` on save — same path the plain Q&A answer already uses, so
 * no new Memory schema is needed for this mode).
 */
export function formatPatternResultAsMarkdown(
  result: PatternAnalysisResult,
): string {
  const observationBlocks = result.observations.map((item) => {
    const lines = [
      `**${item.observation}**`,
      item.why,
      `*Supporting dates:* ${item.supportingDates.join(", ")}`,
    ];
    if (item.counterexamples) {
      lines.push(`*Counterexample:* ${item.counterexamples}`);
    }
    lines.push(`*Confidence:* ${item.confidence}`);
    if (item.suggestion) {
      lines.push(`*Something to try:* ${item.suggestion}`);
    }
    return lines.join("\n\n");
  });

  const blocks = [...observationBlocks];
  if (result.followUps.length > 0) {
    blocks.push(
      [
        "**Questions to explore:**",
        ...result.followUps.map((question) => `- ${question}`),
      ].join("\n"),
    );
  }

  return blocks.join("\n\n---\n\n");
}

/** Every distinct journal date cited across a pattern result's observations. */
export function collectPatternDates(result: PatternAnalysisResult): string[] {
  return [...new Set(result.observations.flatMap((item) => item.supportingDates))];
}

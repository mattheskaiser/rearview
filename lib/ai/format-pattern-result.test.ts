import { describe, expect, it } from "vitest";

import {
  collectPatternDates,
  formatPatternResultAsMarkdown,
} from "@/lib/ai/format-pattern-result";
import type { PatternAnalysisResult } from "@/lib/ai/parse-pattern-response";

const result: PatternAnalysisResult = {
  observations: [
    {
      observation: "You downplay stress with humor.",
      why: "Two excerpts joke right after describing a hard day.",
      supportingDates: ["2025-01-05", "2025-03-12"],
      counterexamples: null,
      confidence: "strong",
    },
    {
      observation: "A second pattern.",
      why: "Because.",
      supportingDates: ["2025-03-12", "2025-06-01"],
      counterexamples: "On 2025-06-01 you addressed it directly instead.",
      confidence: "limited",
    },
  ],
  followUps: ["What would naming it directly look like?"],
};

describe("formatPatternResultAsMarkdown", () => {
  it("includes each observation's fields and the follow-ups", () => {
    const markdown = formatPatternResultAsMarkdown(result);

    expect(markdown).toContain("You downplay stress with humor.");
    expect(markdown).toContain("2025-01-05, 2025-03-12");
    expect(markdown).toContain("Confidence:* strong");
    expect(markdown).toContain("Counterexample:* On 2025-06-01");
    expect(markdown).toContain("Questions to explore");
    expect(markdown).toContain("What would naming it directly look like?");
  });

  it("omits the counterexample line when there is none", () => {
    const markdown = formatPatternResultAsMarkdown(result);
    const firstBlock = markdown.split("\n\n---\n\n")[0];
    expect(firstBlock).not.toContain("Counterexample");
  });

  it("omits the follow-ups section when there are none", () => {
    const markdown = formatPatternResultAsMarkdown({ ...result, followUps: [] });
    expect(markdown).not.toContain("Questions to explore");
  });
});

describe("collectPatternDates", () => {
  it("returns every distinct supporting date across observations", () => {
    expect(collectPatternDates(result)).toEqual([
      "2025-01-05",
      "2025-03-12",
      "2025-06-01",
    ]);
  });

  it("returns an empty array for no observations", () => {
    expect(collectPatternDates({ observations: [], followUps: [] })).toEqual([]);
  });
});

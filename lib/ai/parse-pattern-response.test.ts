import { describe, expect, it } from "vitest";

import { parsePatternResponse } from "@/lib/ai/parse-pattern-response";

const VALID_DATES = new Set(["2025-01-05", "2025-03-12", "2025-06-01"]);

describe("parsePatternResponse", () => {
  it("parses a single observation with all fields", () => {
    const raw = [
      "OBSERVATION: You tend to downplay stress with humor.",
      "WHY: Excerpt [1] and [2] both joke right after describing a hard day.",
      "DATES: 2025-01-05, 2025-03-12",
      "COUNTEREXAMPLES: None noted.",
      "CONFIDENCE: strong",
      "SUGGESTION: Try naming the stress out loud before you reach for a joke.",
      "FOLLOWUPS:",
      "- What would it look like to name the stress directly?",
      "- Does this happen more at work or at home?",
    ].join("\n");

    const result = parsePatternResponse(raw, VALID_DATES);

    expect(result.observations).toEqual([
      {
        observation: "You tend to downplay stress with humor.",
        why: "Excerpt [1] and [2] both joke right after describing a hard day.",
        supportingDates: ["2025-01-05", "2025-03-12"],
        counterexamples: null,
        confidence: "strong",
        suggestion: "Try naming the stress out loud before you reach for a joke.",
      },
    ]);
    expect(result.followUps).toEqual([
      "What would it look like to name the stress directly?",
      "Does this happen more at work or at home?",
    ]);
  });

  it("parses multiple observations separated by ---", () => {
    const raw = [
      "OBSERVATION: First pattern.",
      "WHY: because.",
      "DATES: 2025-01-05",
      "COUNTEREXAMPLES: None noted.",
      "CONFIDENCE: single-instance",
      "---",
      "OBSERVATION: Second pattern.",
      "WHY: because too.",
      "DATES: 2025-03-12, 2025-06-01",
      "COUNTEREXAMPLES: On 2025-06-01 you did the opposite.",
      "CONFIDENCE: limited",
      "FOLLOWUPS:",
      "- A question.",
    ].join("\n");

    const result = parsePatternResponse(raw, VALID_DATES);

    expect(result.observations).toHaveLength(2);
    expect(result.observations[0].observation).toBe("First pattern.");
    expect(result.observations[1].counterexamples).toBe(
      "On 2025-06-01 you did the opposite.",
    );
  });

  it("drops a date the model cited that was never actually retrieved", () => {
    const raw = [
      "OBSERVATION: A pattern.",
      "WHY: because.",
      "DATES: 2025-01-05, 1999-01-01",
      "COUNTEREXAMPLES: None noted.",
      "CONFIDENCE: strong",
    ].join("\n");

    const result = parsePatternResponse(raw, VALID_DATES);

    expect(result.observations[0].supportingDates).toEqual(["2025-01-05"]);
  });

  it("drops an observation entirely when none of its cited dates are verifiable", () => {
    const raw = [
      "OBSERVATION: A hallucinated pattern.",
      "WHY: because.",
      "DATES: 1999-01-01, 2010-05-05",
      "COUNTEREXAMPLES: None noted.",
      "CONFIDENCE: strong",
    ].join("\n");

    const result = parsePatternResponse(raw, VALID_DATES);

    expect(result.observations).toEqual([]);
  });

  it("treats a missing/invalid CONFIDENCE as limited rather than failing", () => {
    const raw = [
      "OBSERVATION: A pattern.",
      "WHY: because.",
      "DATES: 2025-01-05",
      "COUNTEREXAMPLES: None noted.",
      "CONFIDENCE: extremely sure",
    ].join("\n");

    expect(parsePatternResponse(raw, VALID_DATES).observations[0].confidence).toBe(
      "limited",
    );
  });

  it("treats a missing or 'None' SUGGESTION as no suggestion", () => {
    const withNone = [
      "OBSERVATION: A pattern.",
      "WHY: because.",
      "DATES: 2025-01-05",
      "COUNTEREXAMPLES: None noted.",
      "CONFIDENCE: strong",
      "SUGGESTION: None",
    ].join("\n");
    const withoutField = [
      "OBSERVATION: A pattern.",
      "WHY: because.",
      "DATES: 2025-01-05",
      "COUNTEREXAMPLES: None noted.",
      "CONFIDENCE: strong",
    ].join("\n");

    expect(parsePatternResponse(withNone, VALID_DATES).observations[0].suggestion).toBeNull();
    expect(
      parsePatternResponse(withoutField, VALID_DATES).observations[0].suggestion,
    ).toBeNull();
  });

  it("returns no observations for an explicit NO_PATTERN response", () => {
    const raw = "NO_PATTERN: Not enough entries mention this topic yet.";

    expect(parsePatternResponse(raw, VALID_DATES)).toEqual({
      observations: [],
      followUps: [],
    });
  });

  it("returns empty follow-ups when the model omits that section", () => {
    const raw = [
      "OBSERVATION: A pattern.",
      "WHY: because.",
      "DATES: 2025-01-05",
      "COUNTEREXAMPLES: None noted.",
      "CONFIDENCE: strong",
    ].join("\n");

    expect(parsePatternResponse(raw, VALID_DATES).followUps).toEqual([]);
  });

  it("skips a malformed block with no OBSERVATION line instead of throwing", () => {
    const raw = [
      "Some preamble the model added.",
      "---",
      "OBSERVATION: A real one.",
      "WHY: because.",
      "DATES: 2025-01-05",
      "COUNTEREXAMPLES: None noted.",
      "CONFIDENCE: strong",
    ].join("\n");

    const result = parsePatternResponse(raw, VALID_DATES);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].observation).toBe("A real one.");
  });
});

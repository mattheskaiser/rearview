import { describe, expect, it } from "vitest";

import { ANSWER_SYSTEM_PROMPT, buildAnswerPrompt } from "@/lib/ai/answer-prompt";

const evidence = [
  { journalDate: "2022-03-04", text: "Felt uncertain about the new role." },
  { journalDate: "2022-05-19", text: "Wanted more ownership at work." },
];

describe("buildAnswerPrompt", () => {
  it("includes every excerpt with its journal date", () => {
    const prompt = buildAnswerPrompt("career thoughts?", evidence);

    expect(prompt).toContain("2022-03-04");
    expect(prompt).toContain("Felt uncertain about the new role.");
    expect(prompt).toContain("2022-05-19");
    expect(prompt).toContain("Wanted more ownership at work.");
  });

  it("carries the question through verbatim", () => {
    expect(buildAnswerPrompt("career thoughts?", evidence)).toContain(
      "Question: career thoughts?",
    );
  });

  it("instructs the model to answer only from the excerpts", () => {
    expect(buildAnswerPrompt("q", evidence).toLowerCase()).toContain(
      "only the excerpts",
    );
  });

  it("numbers the excerpts so the answer can reference them", () => {
    const prompt = buildAnswerPrompt("q", evidence);
    expect(prompt).toContain("[1] Journal entry — 2022-03-04");
    expect(prompt).toContain("[2] Journal entry — 2022-05-19");
  });
});

describe("ANSWER_SYSTEM_PROMPT", () => {
  it("frames journal excerpts as the source of truth and forbids fabrication", () => {
    const text = ANSWER_SYSTEM_PROMPT.toLowerCase();
    expect(text).toContain("source of truth");
    expect(text).toContain("never invent");
  });

  it("tells the model to communicate uncertainty when evidence is thin", () => {
    expect(ANSWER_SYSTEM_PROMPT.toLowerCase()).toContain("what is missing");
  });
});

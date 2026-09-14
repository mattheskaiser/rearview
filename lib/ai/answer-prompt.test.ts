import { describe, expect, it } from "vitest";

import { buildAnswerSystemPrompt, buildAnswerPrompt } from "@/lib/ai/answer-prompt";

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

  it("instructs the model not to go beyond what's written", () => {
    expect(buildAnswerPrompt("q", evidence).toLowerCase()).toContain(
      "don't go beyond what they show",
    );
  });

  it("numbers the excerpts so the answer can reference them", () => {
    const prompt = buildAnswerPrompt("q", evidence);
    expect(prompt).toContain("[1] Journal entry — 2022-03-04");
    expect(prompt).toContain("[2] Journal entry — 2022-05-19");
  });
});

describe("buildAnswerSystemPrompt", () => {
  it("frames the journal as the source of truth and forbids fabrication", () => {
    const text = buildAnswerSystemPrompt().toLowerCase();
    expect(text).toContain("source of truth");
    expect(text).toContain("never invent");
  });

  it("tells the model to communicate uncertainty when evidence is thin", () => {
    expect(buildAnswerSystemPrompt().toLowerCase()).toContain("what's missing");
  });

  it("addresses the reader directly and bans third-person/clinical framing", () => {
    const text = buildAnswerSystemPrompt().toLowerCase();
    expect(text).toContain('as "you"');
    expect(text).toContain("the writer");
  });

  it("personalizes the intro when a user name is given", () => {
    expect(buildAnswerSystemPrompt("Matthes")).toContain("Matthes's private reflection assistant");
  });

  it("allows a grounded observation as long as it's marked as the model's own read", () => {
    const text = buildAnswerSystemPrompt().toLowerCase();
    expect(text).toContain("own read");
  });
});

import { describe, expect, it } from "vitest";

import {
  MAX_QUESTION_LENGTH,
  memoryCreateSchema,
  questionSchema,
} from "@/lib/validation/memory";

describe("questionSchema", () => {
  it("rejects an empty or whitespace-only question", () => {
    expect(questionSchema.safeParse("").success).toBe(false);
    expect(questionSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects an oversized question", () => {
    expect(questionSchema.safeParse("x".repeat(MAX_QUESTION_LENGTH + 1)).success).toBe(
      false,
    );
  });

  it("trims a valid question", () => {
    const result = questionSchema.safeParse("  What did I learn?  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("What did I learn?");
  });
});

describe("memoryCreateSchema", () => {
  it("defaults entries to an empty array", () => {
    const result = memoryCreateSchema.safeParse({ question: "Q?", answer: "A." });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.entries).toEqual([]);
  });

  it("rejects an empty answer", () => {
    expect(
      memoryCreateSchema.safeParse({ question: "Q?", answer: "  " }).success,
    ).toBe(false);
  });

  it("accepts referenced entries with a date snapshot", () => {
    const result = memoryCreateSchema.safeParse({
      question: "Q?",
      answer: "A.",
      entries: [{ entryId: "abc", journalDate: "2022-03-04" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries[0].journalDate.toISOString()).toBe(
        "2022-03-04T00:00:00.000Z",
      );
    }
  });
});

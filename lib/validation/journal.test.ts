import { describe, expect, it } from "vitest";

import {
  MAX_CONTENT_TEXT_LENGTH,
  journalContentSchema,
  journalDateSchema,
  journalEntryInputSchema,
} from "@/lib/validation/journal";

const docWithText = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("journalDateSchema", () => {
  it("normalizes a YYYY-MM-DD string to midnight UTC", () => {
    const result = journalDateSchema.safeParse("2020-05-01");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toISOString()).toBe("2020-05-01T00:00:00.000Z");
    }
  });

  it("rejects a future date", () => {
    expect(journalDateSchema.safeParse("2999-01-01").success).toBe(false);
  });

  it("rejects a malformed date string", () => {
    expect(journalDateSchema.safeParse("last tuesday").success).toBe(false);
    expect(journalDateSchema.safeParse("2020-13-40").success).toBe(false);
  });
});

describe("journalContentSchema", () => {
  it("extracts contentText from a valid document", () => {
    const result = journalContentSchema.safeParse(docWithText("Hello world"));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contentText).toBe("Hello world");
  });

  it("rejects a document that is not a doc node", () => {
    expect(journalContentSchema.safeParse({ type: "paragraph" }).success).toBe(false);
  });

  it("rejects an empty entry", () => {
    expect(journalContentSchema.safeParse({ type: "doc", content: [] }).success).toBe(
      false,
    );
  });

  it("rejects an oversized entry", () => {
    const huge = docWithText("x".repeat(MAX_CONTENT_TEXT_LENGTH + 1));
    expect(journalContentSchema.safeParse(huge).success).toBe(false);
  });
});

describe("journalEntryInputSchema", () => {
  it("accepts a well-formed entry and produces normalized output", () => {
    const result = journalEntryInputSchema.safeParse({
      journalDate: "2021-02-03",
      content: docWithText("A day."),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content.contentText).toBe("A day.");
      expect(result.data.journalDate.toISOString()).toBe("2021-02-03T00:00:00.000Z");
    }
  });

  it("rejects when the date is in the future", () => {
    const result = journalEntryInputSchema.safeParse({
      journalDate: "2999-12-31",
      content: docWithText("later"),
    });
    expect(result.success).toBe(false);
  });
});

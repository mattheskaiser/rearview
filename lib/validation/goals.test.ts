import { describe, expect, it } from "vitest";

import { MAX_GOALS_LENGTH, goalsContentSchema, goalsUpdateSchema } from "@/lib/validation/goals";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("goalsContentSchema", () => {
  it("allows an empty document", () => {
    const result = goalsContentSchema.safeParse({ type: "doc", content: [] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.text).toBe("");
  });

  it("extracts plain text from the document", () => {
    const result = goalsContentSchema.safeParse(doc("Ship Phase 2"));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.text).toBe("Ship Phase 2");
  });

  it("rejects a non-document payload", () => {
    expect(goalsContentSchema.safeParse({ type: "paragraph" }).success).toBe(false);
  });

  it("rejects text over the length limit", () => {
    expect(goalsContentSchema.safeParse(doc("x".repeat(MAX_GOALS_LENGTH + 1))).success).toBe(
      false,
    );
  });
});

describe("goalsUpdateSchema", () => {
  it("wraps the content field", () => {
    const result = goalsUpdateSchema.safeParse({ content: doc("focus") });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.content.text).toBe("focus");
  });
});

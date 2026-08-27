import { describe, expect, it } from "vitest";

import { MAX_GOALS_LENGTH, goalsTextSchema, goalsUpdateSchema } from "@/lib/validation/goals";

describe("goalsTextSchema", () => {
  it("allows empty text", () => {
    expect(goalsTextSchema.safeParse("").success).toBe(true);
  });

  it("allows ordinary text", () => {
    expect(goalsTextSchema.safeParse("Ship Phase 2\nRest more").success).toBe(true);
  });

  it("rejects oversized text", () => {
    expect(goalsTextSchema.safeParse("x".repeat(MAX_GOALS_LENGTH + 1)).success).toBe(
      false,
    );
  });
});

describe("goalsUpdateSchema", () => {
  it("wraps the text field", () => {
    const result = goalsUpdateSchema.safeParse({ text: "focus" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.text).toBe("focus");
  });
});

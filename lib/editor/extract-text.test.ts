import { describe, expect, it } from "vitest";

import { extractPlainText, type TipTapNode } from "@/lib/editor/extract-text";

const doc = (...content: TipTapNode[]): TipTapNode => ({ type: "doc", content });
const p = (...content: TipTapNode[]): TipTapNode => ({ type: "paragraph", content });
const t = (text: string, marks?: string[]): TipTapNode => ({
  type: "text",
  text,
  ...(marks ? { marks: marks.map((type) => ({ type })) } : {}),
});

describe("extractPlainText", () => {
  it("joins paragraphs with newlines", () => {
    expect(extractPlainText(doc(p(t("First.")), p(t("Second."))))).toBe(
      "First.\nSecond.",
    );
  });

  it("ignores bold and italic marks, keeping the text", () => {
    const d = doc(p(t("plain "), t("bold", ["bold"]), t(" and "), t("it", ["italic"])));
    expect(extractPlainText(d)).toBe("plain bold and it");
  });

  it("prefixes bullet list items with '- '", () => {
    const list: TipTapNode = {
      type: "bulletList",
      content: [
        { type: "listItem", content: [p(t("apples"))] },
        { type: "listItem", content: [p(t("oranges"))] },
      ],
    };
    expect(extractPlainText(doc(p(t("Shopping:")), list))).toBe(
      "Shopping:\n- apples\n- oranges",
    );
  });

  it("turns a hardBreak into a newline within a paragraph", () => {
    expect(
      extractPlainText(doc(p(t("line one"), { type: "hardBreak" }, t("line two")))),
    ).toBe("line one\nline two");
  });

  it("returns an empty string for an empty document", () => {
    expect(extractPlainText(doc())).toBe("");
    expect(extractPlainText({ type: "doc" })).toBe("");
    expect(extractPlainText(null)).toBe("");
  });
});

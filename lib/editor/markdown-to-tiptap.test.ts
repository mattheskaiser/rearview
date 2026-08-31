import { describe, expect, it } from "vitest";

import { extractPlainText } from "@/lib/editor/extract-text";
import { markdownToTiptap } from "@/lib/editor/markdown-to-tiptap";

describe("markdownToTiptap", () => {
  it("splits blank-line-separated blocks into paragraphs", () => {
    const doc = markdownToTiptap("First para.\n\nSecond para.");
    expect(doc.content?.map((n) => n.type)).toEqual(["paragraph", "paragraph"]);
  });

  it("keeps a single newline inside a paragraph as a hardBreak", () => {
    const doc = markdownToTiptap("line one\nline two");
    expect(doc.content?.[0].content?.map((n) => n.type)).toEqual([
      "text",
      "hardBreak",
      "text",
    ]);
  });

  it("turns Markdown '*' / '-' bullets into a real bulletList (no stray asterisks)", () => {
    const doc = markdownToTiptap("* apples\n* oranges");
    const list = doc.content?.[0];
    expect(list?.type).toBe("bulletList");
    expect(list?.content).toHaveLength(2);
    expect(extractPlainText(doc)).toBe("- apples\n- oranges");
    expect(JSON.stringify(doc)).not.toContain("* apples");
  });

  it("turns a numbered Markdown list into an orderedList and seeds its start", () => {
    const doc = markdownToTiptap("3. third\n4. fourth");
    const list = doc.content?.[0];
    expect(list?.type).toBe("orderedList");
    expect(list?.attrs).toEqual({ start: 3 });
    expect(extractPlainText(doc)).toBe("3. third\n4. fourth");
  });

  it("maps **bold** and *italic* onto marks", () => {
    const doc = markdownToTiptap("plain **strong** and *lean*");
    const nodes = doc.content?.[0].content ?? [];
    expect(nodes).toEqual([
      { type: "text", text: "plain " },
      { type: "text", text: "strong", marks: [{ type: "bold" }] },
      { type: "text", text: " and " },
      { type: "text", text: "lean", marks: [{ type: "italic" }] },
    ]);
  });

  it("renders a heading line as a bold paragraph (the editor has no headings)", () => {
    const doc = markdownToTiptap("## Summary");
    expect(doc.content?.[0].type).toBe("paragraph");
    expect(doc.content?.[0].content?.[0]).toEqual({
      type: "text",
      text: "Summary",
      marks: [{ type: "bold" }],
    });
  });

  it("is a safe converter for plain text", () => {
    const doc = markdownToTiptap("Just a sentence.");
    expect(doc).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Just a sentence." }] },
      ],
    });
  });

  it("never returns an empty document", () => {
    expect(markdownToTiptap("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});

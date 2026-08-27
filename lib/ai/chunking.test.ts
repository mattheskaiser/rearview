import { describe, expect, it } from "vitest";

import {
  CHUNK_OVERLAP_CHARS,
  MAX_PARAGRAPH_CHARS,
  TARGET_CHUNK_CHARS,
  chunkText,
} from "@/lib/ai/chunking";

const words = (token: string, count: number) =>
  Array.from({ length: count }, () => token).join(" ");

describe("chunkText", () => {
  it("returns nothing for empty or whitespace-only input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  \t ")).toEqual([]);
  });

  it("keeps a short entry as a single chunk with no overlap prefix", () => {
    const result = chunkText("  A quiet day. Nothing much happened.  ");
    expect(result).toEqual([
      { index: 0, text: "A quiet day. Nothing much happened." },
    ]);
  });

  it("packs multiple small paragraphs into one chunk, newline-joined", () => {
    const result = chunkText("First paragraph.\n\nSecond paragraph.\n\nThird.");
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("First paragraph.\nSecond paragraph.\nThird.");
  });

  it("splits on paragraph boundaries once the target size is exceeded", () => {
    const p1 = words("alpha", 100);
    const p2 = words("bravo", 100);
    const p3 = words("charlie", 100);
    const result = chunkText([p1, p2, p3].join("\n\n"));

    expect(result.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(result[0].text).toBe(p1);
    expect(result[0].text).not.toContain("bravo");
    expect(result[1].text.endsWith(p2)).toBe(true);
    expect(result[2].text.endsWith(p3)).toBe(true);
  });

  it("prefixes each later chunk with a word-aligned tail of the previous one", () => {
    const p1 = words("alpha", 100);
    const p2 = words("bravo", 100);
    const [first, second] = chunkText(`${p1}\n\n${p2}`);

    const overlap = second.text.slice(0, second.text.indexOf("\n"));
    expect(overlap.length).toBeLessThanOrEqual(CHUNK_OVERLAP_CHARS);
    expect(first.text.endsWith(overlap)).toBe(true);
    expect(overlap.startsWith("alpha")).toBe(true);
  });

  it("breaks a single oversized paragraph on sentence boundaries", () => {
    const paragraph = words("This is a sentence.", 120);
    expect(paragraph.length).toBeGreaterThan(MAX_PARAGRAPH_CHARS);

    const result = chunkText(paragraph);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(
        TARGET_CHUNK_CHARS + CHUNK_OVERLAP_CHARS + MAX_PARAGRAPH_CHARS,
      );
    }
  });

  it("hard-splits a single token with no sentence breaks", () => {
    const giant = "x".repeat(MAX_PARAGRAPH_CHARS * 2 + 500);
    const result = chunkText(giant);
    expect(result.length).toBeGreaterThan(1);
    expect(result.map((c) => c.index)).toEqual(
      result.map((_, i) => i),
    );
  });

  it("is deterministic — identical input yields identical chunks", () => {
    const input = `${words("note", 400)}\n\n${words("more", 400)}\n\n${words(
      "end",
      400,
    )}`;
    expect(chunkText(input)).toEqual(chunkText(input));
  });

  it("normalizes CRLF so line endings do not change the output", () => {
    const lf = "One line.\n\nTwo line.";
    const crlf = "One line.\r\n\r\nTwo line.";
    expect(chunkText(crlf)).toEqual(chunkText(lf));
  });
});

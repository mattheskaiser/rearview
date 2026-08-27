import { test, expect } from "@playwright/test";

import { chunkText } from "@/lib/ai/chunking";
import { extractPlainText, type TipTapNode } from "@/lib/editor/extract-text";

import { CORPUS, corpusEntryByDate } from "../fixtures/corpus";
import { plainToTiptap } from "../seed/plain-to-tiptap";

const contentTextOf = (n: number): string => {
  const entry = CORPUS.find((e) => e.n === n);
  if (!entry) throw new Error(`no corpus entry #${n}`);
  return extractPlainText(plainToTiptap(entry.text) as TipTapNode);
};

test("corpus: deterministic extraction, multi-chunk long entries, flags preserved", () => {
  expect(CORPUS.length).toBe(60);

  // Every entry's extracted text is a fixed point of the converter.
  const unstable = CORPUS.filter((e) => {
    const ct = extractPlainText(plainToTiptap(e.text) as TipTapNode);
    return extractPlainText(plainToTiptap(ct) as TipTapNode) !== ct;
  }).map((e) => `#${e.n}`);
  expect(unstable).toEqual([]);

  // The four long entries split into multiple chunks.
  for (const n of [8, 17, 29, 58]) {
    expect(chunkText(contentTextOf(n)).length, `#${n} chunks`).toBeGreaterThan(1);
  }

  // Flagged content survives conversion.
  expect(contentTextOf(25)).toContain("- Raus aus dem Bürojob");
  expect(contentTextOf(25)).toContain("- Endlich Spanisch lernen");
  expect(contentTextOf(35)).toContain("Am 15. September habe ich gekündigt");
  expect(contentTextOf(40)).toMatch(/8\.400\s*€/);
  expect(contentTextOf(40)).toContain("1.700");
  expect(corpusEntryByDate("2024-08-14")?.text).toContain("nlnicht mehr");

  // Language distribution: German majority + exactly the five mixed entries.
  const primary = (lang: string) => (lang.includes("+") ? "mixed" : lang);
  const count = (p: string) => CORPUS.filter((e) => primary(e.lang) === p).length;
  expect(count("de")).toBeGreaterThan(count("en") + count("es"));
  expect(CORPUS.filter((e) => e.lang.includes("+")).map((e) => e.n)).toEqual([
    18, 27, 38, 45, 52,
  ]);
});

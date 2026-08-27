/**
 * Deterministic plain-text chunker (CLAUDE.md > Embeddings).
 *
 * Pure: no DB, no AI, no clock, no randomness. The same input string always
 * produces the exact same ordered chunks, so an unchanged entry never needs
 * re-embedding and a changed one regenerates predictably.
 *
 * Strategy: split into paragraphs, then greedily pack whole paragraphs into
 * chunks up to a target size. A paragraph larger than the hard ceiling is
 * split on sentence boundaries (and, only if a single sentence is still too
 * long, on a fixed character window). Each chunk after the first is prefixed
 * with a word-aligned tail of the previous chunk so context spans the seam.
 */

/** Preferred chunk size in characters. */
export const TARGET_CHUNK_CHARS = 1_000;
/** Characters of the previous chunk repeated at the start of the next. */
export const CHUNK_OVERLAP_CHARS = 150;
/** A paragraph longer than this is broken up before packing. */
export const MAX_PARAGRAPH_CHARS = 1_400;

export type Chunk = {
  /** Zero-based position of this chunk within the entry. */
  index: number;
  text: string;
};

const PARAGRAPH_SPLIT = /\n+/;
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/** Break one oversized paragraph into <= MAX_PARAGRAPH_CHARS pieces. */
function splitLongParagraph(paragraph: string): string[] {
  const pieces: string[] = [];
  let buffer = "";

  for (const sentence of paragraph.split(SENTENCE_SPLIT)) {
    const candidate = buffer ? `${buffer} ${sentence}` : sentence;
    if (candidate.length <= MAX_PARAGRAPH_CHARS) {
      buffer = candidate;
      continue;
    }
    if (buffer) pieces.push(buffer);
    if (sentence.length <= MAX_PARAGRAPH_CHARS) {
      buffer = sentence;
      continue;
    }
    for (let i = 0; i < sentence.length; i += MAX_PARAGRAPH_CHARS) {
      pieces.push(sentence.slice(i, i + MAX_PARAGRAPH_CHARS));
    }
    buffer = "";
  }
  if (buffer) pieces.push(buffer);
  return pieces;
}

/** Word-aligned tail of a chunk, used as the overlap prefix for the next one. */
function overlapTail(text: string): string {
  if (text.length <= CHUNK_OVERLAP_CHARS) return text;
  const tail = text.slice(-CHUNK_OVERLAP_CHARS);
  const firstSpace = tail.indexOf(" ");
  return firstSpace === -1 ? tail : tail.slice(firstSpace + 1);
}

/** Split plain text into ordered, overlapping chunks. */
export function chunkText(input: string): Chunk[] {
  const normalized = input.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return [];

  const paragraphs = normalized
    .split(PARAGRAPH_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => (p.length > MAX_PARAGRAPH_CHARS ? splitLongParagraph(p) : [p]));

  const texts: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length <= TARGET_CHUNK_CHARS || current === "") {
      current = candidate;
    } else {
      texts.push(current);
      current = paragraph;
    }
  }
  if (current) texts.push(current);

  return texts.map((text, index) => ({
    index,
    text: index === 0 ? text : `${overlapTail(texts[index - 1])}\n${text}`,
  }));
}

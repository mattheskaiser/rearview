import type { JSONContent } from "@tiptap/core";

/** A dated pointer to a journal entry that supported an answer. */
export type Evidence = {
  /** YYYY-MM-DD */
  date: string;
  /** Human-readable date label, e.g. "Mar 4, 2022". */
  label: string;
};

/**
 * Evidence shown on the Memories page before the answer arrives: which dated
 * entries were pulled in, as a link — not a text preview. The answer itself
 * quotes the relevant phrases inline, so this is just a "sources" strip for
 * cross-checking; the entry's own content is one click away via `date`. Full
 * chunk sets and embeddings still never reach the client.
 */
export type EvidenceCard = Evidence;

/**
 * One frame of a streamed reflection (retrieval-first, then token-by-token).
 * The evidence frame arrives first (~1s), then tokens, then a terminal frame.
 */
export type ReflectionStreamEvent =
  | { type: "evidence"; evidence: EvidenceCard[] }
  | { type: "token"; value: string }
  | { type: "done" }
  | { type: "error"; error: string };

/** An AI synthesis over retrieved journal evidence (not authoritative). */
export type Reflection = {
  question: string;
  answer: string;
  evidence: Evidence[];
};

/** A saved snapshot of a reflection. */
export type SavedMemory = Reflection & {
  id: string;
  /** ISO timestamp. */
  savedAt: string;
  /**
   * The answer as an editor-native TipTap document — paragraphs, line breaks,
   * bulleted / numbered lists, bold, italic — for consistent rendering. Legacy
   * rows are converted from `answer` on read.
   */
  answerDoc: JSONContent;
};

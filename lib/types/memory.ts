/** A dated pointer to a journal entry that supported an answer. */
export type Evidence = {
  /** YYYY-MM-DD */
  date: string;
  /** Human-readable date label, e.g. "Mar 4, 2022". */
  label: string;
};

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
};

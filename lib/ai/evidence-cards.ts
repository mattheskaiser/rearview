import { formatJournalDateLabel } from "@/lib/time/journal-date";
import type { EvidenceCard } from "@/lib/types/memory";

/**
 * Pure formatting from retrieved chunks to the evidence cards the Memories UI
 * renders. No DB, no AI, no clock — same inputs always build the same cards.
 */

const PREVIEW_CHARS = 150;

function toPreview(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= PREVIEW_CHARS
    ? clean
    : `${clean.slice(0, PREVIEW_CHARS).trimEnd()}…`;
}

/** First chunk per distinct journal date → an evidence card, in rerank order. */
export function toEvidenceCards(
  chunks: { journalDate: string; text: string }[],
): EvidenceCard[] {
  const byDate = new Map<string, EvidenceCard>();
  for (const chunk of chunks) {
    if (byDate.has(chunk.journalDate)) continue;
    byDate.set(chunk.journalDate, {
      date: chunk.journalDate,
      label: formatJournalDateLabel(chunk.journalDate),
      preview: toPreview(chunk.text),
    });
  }
  return [...byDate.values()];
}

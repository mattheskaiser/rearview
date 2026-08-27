import { createHash } from "node:crypto";

/**
 * Deterministic content fingerprint of an entry's extracted plain text.
 *
 * Stored on `JournalEntry.contentHash`. Phase 3 compares it on edit to decide
 * whether existing chunks/embeddings are stale and must be regenerated.
 */
export function hashContentText(contentText: string): string {
  return createHash("sha256").update(contentText, "utf8").digest("hex");
}

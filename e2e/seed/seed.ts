import type { Prisma } from "@prisma/client";

import { syncEntryEmbeddings } from "@/lib/ai/entry-embeddings.service";
import { prisma } from "@/lib/db/client";
import { upsertEntryByDate } from "@/lib/db/journal";
import { hashContentText } from "@/lib/editor/content-hash";
import { extractPlainText } from "@/lib/editor/extract-text";
import { toJournalDate } from "@/lib/time/journal-date";

import { CORPUS } from "../fixtures/corpus";
import { assertTestDatabase } from "../support/assert-test-db";
import { plainToTiptap } from "./plain-to-tiptap";

/**
 * Seed the 60-entry corpus for `userId` the same way the app would: upsert one
 * `JournalEntry` per journal date (reusing `hashContentText` and the production
 * text extraction), then run the real `syncEntryEmbeddings` so chunking and
 * embeddings are byte-for-byte what a save through the editor produces.
 *
 * Not the editor path on purpose — driving Tiptap 60× and waiting on `after()`
 * is slow and flaky. `entries-authoring.spec.ts` covers the editor separately.
 *
 * Guarded: refuses to run unless `DATABASE_URL` is a test database.
 */
export async function seedCorpus(userId: string): Promise<void> {
  assertTestDatabase();

  for (const entry of CORPUS) {
    const doc = plainToTiptap(entry.text);
    const contentText = extractPlainText(doc);
    // Determinism guard: the extracted text must be a fixed point of the
    // converter (paragraphs are joined with single "\n" by extractPlainText).
    if (extractPlainText(plainToTiptap(contentText)) !== contentText) {
      throw new Error(
        `Corpus entry #${entry.n} (${entry.date}) is not a fixed point of ` +
          `plainToTiptap → extractPlainText. Fix the fixture or the converter.`,
      );
    }

    const saved = await upsertEntryByDate({
      userId,
      journalDate: toJournalDate(entry.date),
      content: doc as Prisma.InputJsonValue,
      contentText,
      contentHash: hashContentText(contentText),
    });

    const result = await syncEntryEmbeddings({
      entryId: saved.id,
      contentText,
      contentHash: saved.contentHash,
    });
    if (result.status === "failed") {
      throw new Error(
        `Embedding entry #${entry.n} (${entry.date}) failed: ${result.error}`,
      );
    }
  }
}

/** Count of this suite's chunks that still have no embedding. */
export function countUnembeddedChunks(): Promise<number> {
  return prisma.entryChunk.count({ where: { embeddedAt: null } });
}

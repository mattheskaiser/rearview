import { prisma } from "@/lib/db/client";

import { assertTestDatabase } from "../support/assert-test-db";

/**
 * Delete every journal entry and memory belonging to the test account. The
 * `EntryChunk` and `MemoryEntry` cascades remove chunks / embeddings with them.
 * The account row itself is kept so registration stays locked across runs.
 *
 * Guarded: refuses to run unless `DATABASE_URL` is a test database.
 */
export async function resetTestData(): Promise<void> {
  assertTestDatabase();

  const users = await prisma.user.findMany({ select: { id: true } });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  await prisma.memory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.journalEntry.deleteMany({ where: { userId: { in: userIds } } });
}

import "server-only";

import type { Memory, MemoryEntry, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

/**
 * Focused data access for saved Memories. Thin wrappers over Prisma.
 *
 * Ownership: every function takes the owning `userId`. A memory is never
 * reachable by id alone.
 */

export type MemoryEntryRef = {
  /** null when the cited date no longer has an entry (snapshot still kept). */
  entryId: string | null;
  /** Snapshot of the referenced entry's journal date. */
  journalDate: Date;
};

export type MemoryWriteData = {
  userId: string;
  question: string;
  answer: string;
  /** The answer as editor-native TipTap JSON (see schema `Memory.answerDoc`). */
  answerDoc?: Prisma.InputJsonValue;
  entries: MemoryEntryRef[];
};

export type MemoryWithEntries = Memory & { entries: MemoryEntry[] };

export function createMemory(data: MemoryWriteData): Promise<MemoryWithEntries> {
  const entries: Prisma.MemoryEntryCreateWithoutMemoryInput[] = data.entries.map(
    (ref) => ({ entryId: ref.entryId, journalDate: ref.journalDate }),
  );
  return prisma.memory.create({
    data: {
      userId: data.userId,
      question: data.question,
      answer: data.answer,
      ...(data.answerDoc !== undefined ? { answerDoc: data.answerDoc } : {}),
      entries: { create: entries },
    },
    include: { entries: true },
  });
}

export function listMemories(userId: string): Promise<MemoryWithEntries[]> {
  return prisma.memory.findMany({
    where: { userId },
    include: { entries: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Delete one memory, scoped to its owner. Returns false when nothing matched
 * (wrong id, or not this user's memory) so the caller can report not-found
 * instead of leaking whether the id exists.
 */
export async function deleteMemory(
  id: string,
  userId: string,
): Promise<boolean> {
  const { count } = await prisma.memory.deleteMany({ where: { id, userId } });
  return count > 0;
}

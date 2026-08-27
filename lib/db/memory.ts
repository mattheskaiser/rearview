import "server-only";

import type { Memory, MemoryEntry, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

/**
 * Focused data access for saved Memories. Thin wrappers over Prisma.
 */

export type MemoryEntryRef = {
  /** null when the cited date no longer has an entry (snapshot still kept). */
  entryId: string | null;
  /** Snapshot of the referenced entry's journal date. */
  journalDate: Date;
};

export type MemoryWriteData = {
  question: string;
  answer: string;
  entries: MemoryEntryRef[];
};

export type MemoryWithEntries = Memory & { entries: MemoryEntry[] };

export function createMemory(data: MemoryWriteData): Promise<MemoryWithEntries> {
  const entries: Prisma.MemoryEntryCreateWithoutMemoryInput[] = data.entries.map(
    (ref) => ({ entryId: ref.entryId, journalDate: ref.journalDate }),
  );
  return prisma.memory.create({
    data: {
      question: data.question,
      answer: data.answer,
      entries: { create: entries },
    },
    include: { entries: true },
  });
}

export function listMemories(): Promise<MemoryWithEntries[]> {
  return prisma.memory.findMany({
    include: { entries: true },
    orderBy: { createdAt: "desc" },
  });
}

export function deleteMemory(id: string): Promise<Memory> {
  return prisma.memory.delete({ where: { id } });
}

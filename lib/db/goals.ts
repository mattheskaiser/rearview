import "server-only";

import type { CurrentGoals } from "@prisma/client";

import { prisma } from "@/lib/db/client";

/**
 * Focused data access for Current Goals — a single row at the fixed id
 * "singleton" (see prisma/schema.prisma).
 */

const SINGLETON_ID = "singleton";

/** Returns the goals row, creating an empty one on first access. */
export function getGoals(): Promise<CurrentGoals> {
  return prisma.currentGoals.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, text: "" },
    update: {},
  });
}

export function upsertGoals(text: string): Promise<CurrentGoals> {
  return prisma.currentGoals.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, text },
    update: { text },
  });
}

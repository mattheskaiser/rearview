import "server-only";

import type { CurrentGoals, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";

/**
 * Focused data access for Current Goals — one row per user (see
 * prisma/schema.prisma). Callers pass already-validated values and the owning
 * `userId`; the row is keyed on `userId`.
 */

export type GoalsWriteData = {
  /** TipTap document JSON. */
  content: Prisma.InputJsonValue;
  /** Deterministically extracted plain text. */
  text: string;
};

/** Returns the user's goals row, creating an empty one on first access. */
export function getGoals(userId: string): Promise<CurrentGoals> {
  return prisma.currentGoals.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export function upsertGoals(
  userId: string,
  data: GoalsWriteData,
): Promise<CurrentGoals> {
  return prisma.currentGoals.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

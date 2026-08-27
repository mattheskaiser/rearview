import "server-only";

import { prisma } from "@/lib/db/client";

/**
 * One-time ownership bootstrap.
 *
 * Rearview predates authentication, so existing journal entries, memories and
 * the current-goals row were created with no owner. When the very first account
 * is created we adopt every ownerless record into it, so no private row is ever
 * left global (session prompt > Database).
 *
 * Runs from the Better Auth `user.create.after` hook, guarded by the caller so
 * it only fires for the first user. Idempotent: once claimed, the
 * `userId IS NULL` filter matches nothing.
 */
export async function claimOwnerlessRecords(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.journalEntry.updateMany({
      where: { userId: null },
      data: { userId },
    }),
    prisma.memory.updateMany({
      where: { userId: null },
      data: { userId },
    }),
    prisma.currentGoals.updateMany({
      where: { userId: null },
      data: { userId },
    }),
  ]);
}

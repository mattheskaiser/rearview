import "server-only";

import { prisma } from "@/lib/db/client";

/**
 * Focused data access for user accounts outside a web session — used by the
 * terminal composer, which has no auth cookie and must pick the owning account
 * itself. Returns ids and emails only.
 */

export type UserAccount = { id: string; email: string };

export function listUserAccounts(): Promise<UserAccount[]> {
  return prisma.user.findMany({
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
}

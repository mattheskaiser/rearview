import "server-only";

import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient.
 *
 * In development Next.js hot-reloads modules, which would otherwise open a new
 * connection pool on every reload and exhaust Neon. We stash one instance on
 * the global object and reuse it. In production a single module instance is
 * created normally.
 *
 * "server-only" guarantees this (and the DB credentials it needs) can never be
 * bundled into a Client Component.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

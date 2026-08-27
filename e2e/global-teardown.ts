import { prisma } from "@/lib/db/client";

import { resetTestData } from "./seed/reset";

/**
 * Wipe the seeded corpus after the run so the next run starts clean. Set
 * `KEEP_TEST_DATA=1` to leave it in place for manual inspection of the test DB.
 */
export default async function globalTeardown(): Promise<void> {
  if (process.env.KEEP_TEST_DATA === "1") {
    process.stdout.write("[e2e] KEEP_TEST_DATA=1 — leaving seeded data in place\n");
    return;
  }
  await resetTestData();
  await prisma.$disconnect();
}

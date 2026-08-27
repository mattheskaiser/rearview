import { beforeEach, describe, expect, it, vi } from "vitest";

// The claim runs as a single transaction of three updateMany calls, each
// filtered on `userId: null`. Prisma is mocked — nothing touches Postgres.

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  journalEntry: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
  memory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  currentGoals: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
}));

vi.mock("@/lib/db/client", () => ({ prisma }));

import { claimOwnerlessRecords } from "@/lib/auth/bootstrap";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("claimOwnerlessRecords", () => {
  it("adopts every ownerless journal entry, memory and goals row into the user", async () => {
    await claimOwnerlessRecords("user-1");

    for (const model of [
      prisma.journalEntry,
      prisma.memory,
      prisma.currentGoals,
    ]) {
      expect(model.updateMany).toHaveBeenCalledWith({
        where: { userId: null },
        data: { userId: "user-1" },
      });
    }
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("never touches rows that already have an owner (filter is userId: null)", async () => {
    await claimOwnerlessRecords("user-1");

    const filters = [
      prisma.journalEntry.updateMany,
      prisma.memory.updateMany,
      prisma.currentGoals.updateMany,
    ].map((fn) => fn.mock.calls[0][0].where);

    expect(filters).toEqual([
      { userId: null },
      { userId: null },
      { userId: null },
    ]);
  });
});

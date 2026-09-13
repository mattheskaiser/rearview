import { beforeEach, describe, expect, it, vi } from "vitest";

// Application-logic tests for the manual backup boundary. Prisma is mocked;
// nothing here touches a real database. The snapshot is stored in Postgres
// (Backup.content) rather than a local file.

const backupDb = vi.hoisted(() => ({
  createBackupRecord: vi.fn(),
  getLastBackupRecord: vi.fn(),
  pruneOldBackups: vi.fn(),
}));
const journalDb = vi.hoisted(() => ({ listAllEntriesForUser: vi.fn() }));
const memoryDb = vi.hoisted(() => ({ listMemories: vi.fn() }));
const goalsDb = vi.hoisted(() => ({ getGoals: vi.fn() }));

vi.mock("@/lib/db/backup", () => backupDb);
vi.mock("@/lib/db/journal", () => journalDb);
vi.mock("@/lib/db/memory", () => memoryDb);
vi.mock("@/lib/db/goals", () => goalsDb);

import { getLastBackup, runBackup } from "@/lib/backup.service";

const USER = "user-1";
const utc = (date: string) => new Date(`${date}T00:00:00.000Z`);

beforeEach(() => {
  vi.clearAllMocks();
  journalDb.listAllEntriesForUser.mockResolvedValue([]);
  memoryDb.listMemories.mockResolvedValue([]);
  goalsDb.getGoals.mockResolvedValue({ content: {}, text: "" });
});

describe("runBackup", () => {
  it("stores a JSON snapshot of entries, memories and goals, then prunes older backups", async () => {
    journalDb.listAllEntriesForUser.mockResolvedValue([
      {
        journalDate: utc("2022-03-04"),
        content: { type: "doc", content: [] },
        contentText: "hello",
        createdAt: utc("2022-03-04"),
        updatedAt: utc("2022-03-05"),
      },
    ]);
    memoryDb.listMemories.mockResolvedValue([
      {
        question: "career?",
        answer: "A grounded answer.",
        answerDoc: { type: "doc", content: [] },
        createdAt: utc("2023-01-12"),
        entries: [{ journalDate: utc("2022-03-04") }],
      },
    ]);
    goalsDb.getGoals.mockResolvedValue({ content: { type: "doc" }, text: "goal text" });
    backupDb.createBackupRecord.mockResolvedValue({
      id: "b1",
      createdAt: utc("2023-01-12"),
      entryCount: 1,
      memoryCount: 1,
    });

    const result = await runBackup(USER);

    expect(result.ok).toBe(true);
    const written = backupDb.createBackupRecord.mock.calls[0][0];
    expect(written.userId).toBe(USER);
    expect(written.entryCount).toBe(1);
    expect(written.memoryCount).toBe(1);
    expect(written.content.entries).toEqual([
      {
        journalDate: "2022-03-04",
        content: { type: "doc", content: [] },
        contentText: "hello",
        createdAt: "2022-03-04T00:00:00.000Z",
        updatedAt: "2022-03-05T00:00:00.000Z",
      },
    ]);
    expect(written.content.memories).toEqual([
      {
        question: "career?",
        answer: "A grounded answer.",
        answerDoc: { type: "doc", content: [] },
        referencedDates: ["2022-03-04"],
        createdAt: "2023-01-12T00:00:00.000Z",
      },
    ]);
    expect(written.content.currentGoals).toEqual({
      content: { type: "doc" },
      text: "goal text",
    });

    // History is bounded — pruning runs after every backup.
    expect(backupDb.pruneOldBackups).toHaveBeenCalledWith(USER, 5);

    if (!result.ok) throw new Error("expected ok result");
    expect(result.summary.entryCount).toBe(1);
    expect(result.summary.memoryCount).toBe(1);
  });

  it("reports a friendly error and never throws when the write fails", async () => {
    backupDb.createBackupRecord.mockRejectedValue(new Error("connection refused"));

    const result = await runBackup(USER);

    expect(result).toEqual({
      ok: false,
      error: "Could not create a backup. Please try again.",
    });
    expect(backupDb.pruneOldBackups).not.toHaveBeenCalled();
  });
});

describe("getLastBackup", () => {
  it("returns null when a backup has never run", async () => {
    backupDb.getLastBackupRecord.mockResolvedValue(null);

    expect(await getLastBackup(USER)).toBeNull();
  });

  it("formats the most recent backup record", async () => {
    backupDb.getLastBackupRecord.mockResolvedValue({
      id: "b1",
      createdAt: utc("2023-01-12"),
      entryCount: 3,
      memoryCount: 2,
    });

    const summary = await getLastBackup(USER);

    expect(summary?.createdAt).toBe("2023-01-12T00:00:00.000Z");
    expect(summary?.entryCount).toBe(3);
    expect(summary?.memoryCount).toBe(2);
    expect(typeof summary?.formattedCreatedAt).toBe("string");
  });
});

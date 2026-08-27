import { beforeEach, describe, expect, it, vi } from "vitest";

// Application-logic tests for the Overview boundary. The goals row and the
// entry-date query are mocked; the real Zod validation runs. Nothing touches
// Postgres.

vi.mock("@/lib/env", () => ({
  env: { REARVIEW_USER_NAME: "Alex" },
}));

const goalsDb = vi.hoisted(() => ({
  getGoals: vi.fn(),
  upsertGoals: vi.fn(),
}));
const journalDb = vi.hoisted(() => ({ listEntryDates: vi.fn() }));

vi.mock("@/lib/db/goals", () => goalsDb);
vi.mock("@/lib/db/journal", () => journalDb);

import { getOverviewData, saveGoals } from "@/lib/overview.service";
import { MAX_GOALS_LENGTH } from "@/lib/validation/goals";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOverviewData", () => {
  it("assembles the greeting name, goals text and entry dates", async () => {
    goalsDb.getGoals.mockResolvedValue({ id: "singleton", text: "Ship Phase 6" });
    journalDb.listEntryDates.mockResolvedValue(["2026-08-01", "2026-08-27"]);

    await expect(getOverviewData()).resolves.toEqual({
      name: "Alex",
      goals: "Ship Phase 6",
      entryDates: ["2026-08-01", "2026-08-27"],
    });
  });

  it("degrades to empty goals when the goals row is unreachable", async () => {
    goalsDb.getGoals.mockRejectedValue(new Error("connection refused"));
    journalDb.listEntryDates.mockResolvedValue(["2026-08-27"]);

    await expect(getOverviewData()).resolves.toEqual({
      name: "Alex",
      goals: "",
      entryDates: ["2026-08-27"],
    });
  });

  it("degrades to no activity when the entry-date query fails", async () => {
    goalsDb.getGoals.mockResolvedValue({ id: "singleton", text: "keep writing" });
    journalDb.listEntryDates.mockRejectedValue(new Error("db down"));

    await expect(getOverviewData()).resolves.toEqual({
      name: "Alex",
      goals: "keep writing",
      entryDates: [],
    });
  });
});

describe("saveGoals", () => {
  it("persists valid goals text and returns the stored value", async () => {
    goalsDb.upsertGoals.mockResolvedValue({ id: "singleton", text: "Read more" });

    const result = await saveGoals({ text: "Read more" });

    expect(result).toEqual({ ok: true, text: "Read more" });
    expect(goalsDb.upsertGoals).toHaveBeenCalledWith("Read more");
  });

  it("accepts clearing the goals to an empty string", async () => {
    goalsDb.upsertGoals.mockResolvedValue({ id: "singleton", text: "" });

    const result = await saveGoals({ text: "" });

    expect(result).toEqual({ ok: true, text: "" });
    expect(goalsDb.upsertGoals).toHaveBeenCalledWith("");
  });

  it("rejects text over the length limit without touching the database", async () => {
    const result = await saveGoals({ text: "x".repeat(MAX_GOALS_LENGTH + 1) });

    expect(result.ok).toBe(false);
    expect(goalsDb.upsertGoals).not.toHaveBeenCalled();
  });

  it("rejects a malformed payload without touching the database", async () => {
    const result = await saveGoals({ text: 123 });

    expect(result.ok).toBe(false);
    expect(goalsDb.upsertGoals).not.toHaveBeenCalled();
  });

  it("returns a generic error (no DB internals) when the write fails", async () => {
    goalsDb.upsertGoals.mockRejectedValue(new Error("postgres://secret@host"));

    const result = await saveGoals({ text: "anything" });

    expect(result).toEqual({
      ok: false,
      error: "Could not save your goals. Please try again.",
    });
  });
});

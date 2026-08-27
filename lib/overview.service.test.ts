import { beforeEach, describe, expect, it, vi } from "vitest";

// Application-logic tests for the Overview boundary. The goals row and the
// entry-date query are mocked; the real Zod validation runs. Nothing touches
// Postgres. The greeting/timezone helpers are stubbed for determinism. Every
// call is scoped to a userId.

vi.mock("@/lib/env", () => ({
  env: { REARVIEW_USER_NAME: "Alex" },
}));

vi.mock("@/lib/time/greeting", () => ({
  getZonedGreeting: () => "afternoon",
}));

vi.mock("@/lib/time/timezone", () => ({
  zonedTodayString: () => "2026-08-27",
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

const USER = "user-1";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOverviewData", () => {
  it("assembles the greeting, goals document, entry dates and today for the user", async () => {
    goalsDb.getGoals.mockResolvedValue({ content: doc("Ship Phase 6") });
    journalDb.listEntryDates.mockResolvedValue(["2026-08-01", "2026-08-27"]);

    await expect(getOverviewData(USER, "Matthes")).resolves.toEqual({
      name: "Matthes",
      greeting: "afternoon",
      goalsContent: doc("Ship Phase 6"),
      entryDates: ["2026-08-01", "2026-08-27"],
      today: "2026-08-27",
    });
    expect(goalsDb.getGoals).toHaveBeenCalledWith(USER);
    expect(journalDb.listEntryDates).toHaveBeenCalledWith(USER);
  });

  it("falls back to the configured name when the account has none", async () => {
    goalsDb.getGoals.mockResolvedValue({ content: {} });
    journalDb.listEntryDates.mockResolvedValue([]);

    const data = await getOverviewData(USER);
    expect(data.name).toBe("Alex");
  });

  it("treats an unset / non-doc goals value as no goals", async () => {
    goalsDb.getGoals.mockResolvedValue({ content: {} });
    journalDb.listEntryDates.mockResolvedValue([]);

    const data = await getOverviewData(USER, "Matthes");
    expect(data.goalsContent).toBeNull();
  });

  it("degrades to empty goals when the goals row is unreachable", async () => {
    goalsDb.getGoals.mockRejectedValue(new Error("connection refused"));
    journalDb.listEntryDates.mockResolvedValue(["2026-08-27"]);

    const data = await getOverviewData(USER, "Matthes");
    expect(data.goalsContent).toBeNull();
    expect(data.entryDates).toEqual(["2026-08-27"]);
  });

  it("degrades to no activity when the entry-date query fails", async () => {
    goalsDb.getGoals.mockResolvedValue({ content: doc("keep writing") });
    journalDb.listEntryDates.mockRejectedValue(new Error("db down"));

    const data = await getOverviewData(USER, "Matthes");
    expect(data.entryDates).toEqual([]);
  });
});

describe("saveGoals", () => {
  it("persists a valid document with its extracted plain text, scoped to the user", async () => {
    goalsDb.upsertGoals.mockResolvedValue({});

    const result = await saveGoals(USER, { content: doc("Read more") });

    expect(result).toEqual({ ok: true });
    expect(goalsDb.upsertGoals).toHaveBeenCalledWith(USER, {
      content: doc("Read more"),
      text: "Read more",
    });
  });

  it("accepts clearing the goals to an empty document", async () => {
    goalsDb.upsertGoals.mockResolvedValue({});

    const result = await saveGoals(USER, { content: { type: "doc", content: [] } });

    expect(result).toEqual({ ok: true });
    expect(goalsDb.upsertGoals).toHaveBeenCalledWith(USER, {
      content: { type: "doc", content: [] },
      text: "",
    });
  });

  it("rejects text over the length limit without touching the database", async () => {
    const result = await saveGoals(USER, { content: doc("x".repeat(MAX_GOALS_LENGTH + 1)) });

    expect(result.ok).toBe(false);
    expect(goalsDb.upsertGoals).not.toHaveBeenCalled();
  });

  it("rejects a malformed payload without touching the database", async () => {
    const result = await saveGoals(USER, { content: { type: "not-a-doc" } });

    expect(result.ok).toBe(false);
    expect(goalsDb.upsertGoals).not.toHaveBeenCalled();
  });

  it("returns a generic error (no DB internals) when the write fails", async () => {
    goalsDb.upsertGoals.mockRejectedValue(new Error("postgres://secret@host"));

    const result = await saveGoals(USER, { content: doc("anything") });

    expect(result).toEqual({
      ok: false,
      error: "Could not save your goals. Please try again.",
    });
  });
});

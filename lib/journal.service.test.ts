import { beforeEach, describe, expect, it, vi } from "vitest";

// Application-logic tests: the real validation + hashing runs; the DB and the
// embedding service are mocked so nothing touches Postgres or Ollama. Every
// call is scoped to a userId, which must reach the data layer unchanged.

const db = vi.hoisted(() => ({
  createJournalEntry: vi.fn(),
  getEntryByDate: vi.fn(),
  updateEntryContent: vi.fn(),
  deleteEntryById: vi.fn(),
}));
const ai = vi.hoisted(() => ({ syncEntryEmbeddings: vi.fn() }));

vi.mock("@/lib/db/journal", () => db);
vi.mock("@/lib/ai/entry-embeddings.service", () => ai);

import { hashContentText } from "@/lib/editor/content-hash";
import {
  deleteJournalEntry,
  hasJournalEntryOnDate,
  runEntryEmbeddingSync,
  saveJournalEntry,
  updateJournalEntry,
} from "@/lib/journal.service";

const USER = "user-1";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

beforeEach(() => {
  vi.clearAllMocks();
  db.getEntryByDate.mockResolvedValue(null);
  db.createJournalEntry.mockImplementation((data) =>
    Promise.resolve({
      id: "entry-1",
      ...data,
      createdAt: new Date("2026-08-27T09:00:00.000Z"),
      updatedAt: new Date("2026-08-27T09:00:00.000Z"),
    }),
  );
  db.updateEntryContent.mockResolvedValue(1);
});

describe("saveJournalEntry", () => {
  it("creates a new entry scoped to the user, with a normalized date and a hash of the extracted text", async () => {
    const result = await saveJournalEntry(USER, {
      journalDate: "2026-08-20",
      content: doc("Hello world"),
    });

    expect(result).toEqual({
      ok: true,
      entry: { id: "entry-1", journalDate: "2026-08-20" },
    });
    const written = db.createJournalEntry.mock.calls[0][0];
    expect(written.userId).toBe(USER);
    expect(written.journalDate.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(written.contentText).toBe("Hello world");
    expect(written.contentHash).toBe(hashContentText("Hello world"));
    expect(written.content).toEqual(doc("Hello world"));
  });

  it("accepts a historical journal date and never writes createdAt itself", async () => {
    const result = await saveJournalEntry(USER, {
      journalDate: "2015-03-04",
      content: doc("A day years ago"),
    });

    expect(result.ok && result.entry.journalDate).toBe("2015-03-04");
    const written = db.createJournalEntry.mock.calls[0][0];
    expect(written.journalDate.toISOString()).toBe("2015-03-04T00:00:00.000Z");
    expect(written).not.toHaveProperty("createdAt");
  });

  it("refuses a second entry for a date that already has one", async () => {
    db.getEntryByDate.mockResolvedValueOnce({ id: "existing" });
    const result = await saveJournalEntry(USER, {
      journalDate: "2026-08-20",
      content: doc("another one"),
    });

    expect(result.ok).toBe(false);
    expect(result).toEqual({
      ok: false,
      error:
        "You already have an entry for this date. Edit it from the Journal Archive.",
    });
    expect(db.createJournalEntry).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint race (P2002) to the same friendly message", async () => {
    db.createJournalEntry.mockRejectedValueOnce({ code: "P2002" });
    const result = await saveJournalEntry(USER, {
      journalDate: "2026-08-20",
      content: doc("lost the race"),
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/already have an entry/);
  });

  it("hands the saved id, text and hash to the onSaved callback for deferred embedding", async () => {
    const onSaved = vi.fn();
    await saveJournalEntry(
      USER,
      { journalDate: "2026-08-20", content: doc("embed me") },
      onSaved,
    );

    expect(onSaved).toHaveBeenCalledWith({
      id: "entry-1",
      contentText: "embed me",
      contentHash: hashContentText("embed me"),
    });
  });

  it("rejects an empty entry without touching the database", async () => {
    const result = await saveJournalEntry(USER, {
      journalDate: "2026-08-20",
      content: { type: "doc", content: [] },
    });

    expect(result.ok).toBe(false);
    expect(db.createJournalEntry).not.toHaveBeenCalled();
  });

  it("rejects a future journal date", async () => {
    const result = await saveJournalEntry(USER, {
      journalDate: "2999-01-01",
      content: doc("from the future"),
    });

    expect(result).toEqual({
      ok: false,
      error: "Journal date cannot be in the future",
    });
    expect(db.createJournalEntry).not.toHaveBeenCalled();
  });

  it("returns a generic error and no callback when the database write fails", async () => {
    db.createJournalEntry.mockRejectedValueOnce(
      new Error("connection string postgres://secret"),
    );
    const onSaved = vi.fn();

    const result = await saveJournalEntry(
      USER,
      { journalDate: "2026-08-20", content: doc("boom") },
      onSaved,
    );

    expect(result).toEqual({
      ok: false,
      error: "Could not save your entry. Please try again.",
    });
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("updateJournalEntry", () => {
  it("updates by (userId, entryId) and re-hashes the changed text", async () => {
    const onSaved = vi.fn();
    const result = await updateJournalEntry(
      USER,
      { entryId: "entry-9", content: doc("rewritten") },
      onSaved,
    );

    expect(result.ok).toBe(true);
    const [userArg, idArg, data] = db.updateEntryContent.mock.calls[0];
    expect(userArg).toBe(USER);
    expect(idArg).toBe("entry-9");
    expect(data.contentHash).toBe(hashContentText("rewritten"));
    expect(onSaved).toHaveBeenCalledWith({
      id: "entry-9",
      contentText: "rewritten",
      contentHash: hashContentText("rewritten"),
    });
  });

  it("reports when the entry no longer exists", async () => {
    db.updateEntryContent.mockResolvedValueOnce(0);
    const result = await updateJournalEntry(USER, {
      entryId: "gone",
      content: doc("nope"),
    });
    expect(result).toEqual({ ok: false, error: "That entry no longer exists." });
  });

  it("rejects an empty edit without touching the database", async () => {
    const result = await updateJournalEntry(USER, {
      entryId: "entry-9",
      content: { type: "doc", content: [] },
    });
    expect(result.ok).toBe(false);
    expect(db.updateEntryContent).not.toHaveBeenCalled();
  });
});

describe("runEntryEmbeddingSync", () => {
  const entry = { id: "entry-1", contentText: "text", contentHash: "hash" };

  it("delegates to syncEntryEmbeddings with the entry identity", async () => {
    ai.syncEntryEmbeddings.mockResolvedValueOnce({
      status: "regenerated",
      chunkCount: 1,
      embedded: 1,
    });
    await runEntryEmbeddingSync(entry);

    expect(ai.syncEntryEmbeddings).toHaveBeenCalledWith({
      entryId: "entry-1",
      contentText: "text",
      contentHash: "hash",
    });
  });

  it("never rejects when embedding generation fails (Ollama down / chunk-store error)", async () => {
    ai.syncEntryEmbeddings.mockRejectedValueOnce(new Error("Ollama unreachable"));
    await expect(runEntryEmbeddingSync(entry)).resolves.toBeUndefined();
  });
});

describe("deleteJournalEntry", () => {
  it("deletes by (userId, entryId) and reports whether a row went", async () => {
    db.deleteEntryById.mockResolvedValueOnce(true);
    await expect(deleteJournalEntry(USER, "entry-1")).resolves.toBe(true);
    expect(db.deleteEntryById.mock.calls[0]).toEqual([USER, "entry-1"]);
  });

  it("returns false when there was no entry or the delete throws", async () => {
    db.deleteEntryById.mockResolvedValueOnce(false);
    await expect(deleteJournalEntry(USER, "entry-1")).resolves.toBe(false);

    db.deleteEntryById.mockRejectedValueOnce(new Error("db down"));
    await expect(deleteJournalEntry(USER, "entry-1")).resolves.toBe(false);
  });
});

describe("hasJournalEntryOnDate", () => {
  it("is true when the user has an entry on that date", async () => {
    db.getEntryByDate.mockResolvedValueOnce({ id: "entry-1" });
    await expect(hasJournalEntryOnDate(USER, "2026-08-20")).resolves.toBe(true);

    const [userArg, dateArg] = db.getEntryByDate.mock.calls[0];
    expect(userArg).toBe(USER);
    expect(dateArg.toISOString()).toBe("2026-08-20T00:00:00.000Z");
  });

  it("is false when the date has no entry for this user", async () => {
    db.getEntryByDate.mockResolvedValueOnce(null);
    await expect(hasJournalEntryOnDate(USER, "2026-08-20")).resolves.toBe(false);
  });
});

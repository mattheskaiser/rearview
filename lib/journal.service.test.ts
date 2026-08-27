import { beforeEach, describe, expect, it, vi } from "vitest";

// Application-logic tests: the real validation + hashing runs; the DB and the
// embedding service are mocked so nothing touches Postgres or Ollama. Every
// call is scoped to a userId, which must reach the data layer unchanged.

const db = vi.hoisted(() => ({
  upsertEntryByDate: vi.fn(),
  getEntryByDate: vi.fn(),
  deleteEntryByDate: vi.fn(),
}));
const ai = vi.hoisted(() => ({ syncEntryEmbeddings: vi.fn() }));

vi.mock("@/lib/db/journal", () => db);
vi.mock("@/lib/ai/entry-embeddings.service", () => ai);

import { hashContentText } from "@/lib/editor/content-hash";
import {
  deleteJournalEntry,
  getEntryContentForDate,
  runEntryEmbeddingSync,
  saveJournalEntry,
} from "@/lib/journal.service";

const USER = "user-1";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

beforeEach(() => {
  vi.clearAllMocks();
  db.upsertEntryByDate.mockImplementation((data) =>
    Promise.resolve({
      id: "entry-1",
      ...data,
      createdAt: new Date("2026-08-27T09:00:00.000Z"),
      updatedAt: new Date("2026-08-27T09:00:00.000Z"),
    }),
  );
});

describe("saveJournalEntry", () => {
  it("persists a new entry scoped to the user, with a normalized date and a hash of the extracted text", async () => {
    const result = await saveJournalEntry(USER, {
      journalDate: "2026-08-20",
      content: doc("Hello world"),
    });

    expect(result).toEqual({
      ok: true,
      entry: { id: "entry-1", journalDate: "2026-08-20" },
    });
    const written = db.upsertEntryByDate.mock.calls[0][0];
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
    const written = db.upsertEntryByDate.mock.calls[0][0];
    expect(written.journalDate.toISOString()).toBe("2015-03-04T00:00:00.000Z");
    expect(written).not.toHaveProperty("createdAt");
  });

  it("re-saves the same journal date on edit and updates the hash when text changes", async () => {
    await saveJournalEntry(USER, { journalDate: "2026-08-20", content: doc("first version") });
    await saveJournalEntry(USER, { journalDate: "2026-08-20", content: doc("second version") });

    const [first, second] = db.upsertEntryByDate.mock.calls.map((c) => c[0]);
    expect(first.journalDate.toISOString()).toBe(second.journalDate.toISOString());
    expect(first.contentHash).not.toBe(second.contentHash);
    expect(second.contentHash).toBe(hashContentText("second version"));
  });

  it("produces an identical hash when the entry text is unchanged", async () => {
    await saveJournalEntry(USER, { journalDate: "2026-08-20", content: doc("stable text") });
    await saveJournalEntry(USER, {
      journalDate: "2026-08-20",
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "stable text" }] },
        ],
      },
    });

    const [first, second] = db.upsertEntryByDate.mock.calls.map((c) => c[0]);
    expect(first.contentHash).toBe(second.contentHash);
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
    expect(db.upsertEntryByDate).not.toHaveBeenCalled();
  });

  it("rejects a future journal date", async () => {
    const result = await saveJournalEntry(USER, {
      journalDate: "2999-01-01",
      content: doc("from the future"),
    });

    expect(result).toEqual({ ok: false, error: "Journal date cannot be in the future" });
    expect(db.upsertEntryByDate).not.toHaveBeenCalled();
  });

  it("returns a generic error and no callback when the database write fails", async () => {
    db.upsertEntryByDate.mockRejectedValueOnce(new Error("connection string postgres://secret"));
    const onSaved = vi.fn();

    const result = await saveJournalEntry(
      USER,
      { journalDate: "2026-08-20", content: doc("boom") },
      onSaved,
    );

    expect(result).toEqual({ ok: false, error: "Could not save your entry. Please try again." });
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("runEntryEmbeddingSync", () => {
  const entry = { id: "entry-1", contentText: "text", contentHash: "hash" };

  it("delegates to syncEntryEmbeddings with the entry identity", async () => {
    ai.syncEntryEmbeddings.mockResolvedValueOnce({ status: "regenerated", chunkCount: 1, embedded: 1 });
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
  it("deletes by (userId, normalized date) and reports whether a row went", async () => {
    db.deleteEntryByDate.mockResolvedValueOnce(true);
    await expect(deleteJournalEntry(USER, "2026-08-20")).resolves.toBe(true);

    const [userArg, dateArg] = db.deleteEntryByDate.mock.calls[0];
    expect(userArg).toBe(USER);
    expect(dateArg.toISOString()).toBe("2026-08-20T00:00:00.000Z");
  });

  it("returns false when there was no entry or the delete throws", async () => {
    db.deleteEntryByDate.mockResolvedValueOnce(false);
    await expect(deleteJournalEntry(USER, "2026-08-20")).resolves.toBe(false);

    db.deleteEntryByDate.mockRejectedValueOnce(new Error("db down"));
    await expect(deleteJournalEntry(USER, "2026-08-20")).resolves.toBe(false);
  });
});

describe("getEntryContentForDate", () => {
  it("looks the entry up by (userId, date) and returns its document", async () => {
    db.getEntryByDate.mockResolvedValueOnce({ content: doc("recorded") });
    await expect(getEntryContentForDate(USER, "2026-08-20")).resolves.toEqual(doc("recorded"));

    const [userArg, dateArg] = db.getEntryByDate.mock.calls[0];
    expect(userArg).toBe(USER);
    expect(dateArg.toISOString()).toBe("2026-08-20T00:00:00.000Z");
  });

  it("returns null when the date has no entry for this user", async () => {
    db.getEntryByDate.mockResolvedValueOnce(null);
    await expect(getEntryContentForDate(USER, "2026-08-20")).resolves.toBeNull();
  });
});

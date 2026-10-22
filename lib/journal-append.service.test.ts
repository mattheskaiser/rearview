import { beforeEach, describe, expect, it, vi } from "vitest";

// The real journal service, validation and hashing run; only the DB and the
// embedding service are mocked.

const db = vi.hoisted(() => ({
  createJournalEntry: vi.fn(),
  getEntryByDate: vi.fn(),
  updateEntryContent: vi.fn(),
  deleteEntryById: vi.fn(),
}));
vi.mock("@/lib/db/journal", () => db);
vi.mock("@/lib/ai/entry-embeddings.service", () => ({ syncEntryEmbeddings: vi.fn() }));

import { hashContentText } from "@/lib/editor/content-hash";
import { saveOrAppendJournalEntry } from "@/lib/journal-append.service";

const USER = "user-1";
const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...texts: string[]) => ({ type: "doc", content: texts.map(para) });

beforeEach(() => {
  vi.clearAllMocks();
  db.getEntryByDate.mockResolvedValue(null);
  db.createJournalEntry.mockImplementation((data) =>
    Promise.resolve({ id: "new-entry", ...data }),
  );
  db.updateEntryContent.mockResolvedValue(1);
});

describe("saveOrAppendJournalEntry", () => {
  it("creates a new entry on a date with no entry yet", async () => {
    const onSaved = vi.fn();
    const result = await saveOrAppendJournalEntry(USER, "2026-10-01", doc("Hello"), onSaved);

    expect(result).toEqual({ ok: true, mode: "created", entryId: "new-entry" });
    expect(db.createJournalEntry.mock.calls[0][0].userId).toBe(USER);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ contentText: "Hello" }));
  });

  it("appends to an existing entry for that date and re-hashes the combined text", async () => {
    db.getEntryByDate.mockResolvedValue({ id: "old-entry", content: doc("Morning") });
    const onSaved = vi.fn();

    const result = await saveOrAppendJournalEntry(USER, "2026-10-01", doc("Evening"), onSaved);

    expect(result).toEqual({ ok: true, mode: "appended", entryId: "old-entry" });
    expect(db.createJournalEntry).not.toHaveBeenCalled();
    const [userId, entryId, written] = db.updateEntryContent.mock.calls[0];
    expect([userId, entryId]).toEqual([USER, "old-entry"]);
    expect(written.content).toEqual(doc("Morning", "Evening"));
    expect(written.contentText).toBe("Morning\nEvening");
    expect(written.contentHash).toBe(hashContentText("Morning\nEvening"));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "old-entry" }));
  });

  it("rejects an empty document without writing anything", async () => {
    const result = await saveOrAppendJournalEntry(USER, "2026-10-01", { type: "doc", content: [] });

    expect(result.ok).toBe(false);
    expect(db.createJournalEntry).not.toHaveBeenCalled();
  });

  it("reports a database outage instead of throwing", async () => {
    db.getEntryByDate.mockRejectedValue(new Error("connection refused"));

    const result = await saveOrAppendJournalEntry(USER, "2026-10-01", doc("Hi"));

    expect(result).toEqual({ ok: false, error: "Could not reach the journal database." });
  });
});

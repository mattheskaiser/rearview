import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ listEntriesPendingEmbeddingSync: vi.fn() }));
const ai = vi.hoisted(() => ({ syncEntryEmbeddings: vi.fn() }));

vi.mock("@/lib/db/chunks", () => db);
vi.mock("@/lib/ai/entry-embeddings.service", () => ai);

import { syncPendingEmbeddingsForUser } from "@/lib/ai/embedding-backfill.service";

const USER = "user-1";

const pendingEntry = (id: string) => ({
  entryId: id,
  contentText: `entry ${id} text`,
  contentHash: `hash-${id}`,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncPendingEmbeddingsForUser", () => {
  it("does nothing when no entries are pending", async () => {
    db.listEntriesPendingEmbeddingSync.mockResolvedValue([]);

    await expect(syncPendingEmbeddingsForUser(USER)).resolves.toEqual({
      attempted: 0,
      succeeded: 0,
    });
    expect(ai.syncEntryEmbeddings).not.toHaveBeenCalled();
  });

  it("bounds the query by the default max entries", async () => {
    db.listEntriesPendingEmbeddingSync.mockResolvedValue([]);

    await syncPendingEmbeddingsForUser(USER);

    expect(db.listEntriesPendingEmbeddingSync).toHaveBeenCalledWith(USER, 5);
  });

  it("respects a caller-supplied maxEntries bound", async () => {
    db.listEntriesPendingEmbeddingSync.mockResolvedValue([]);

    await syncPendingEmbeddingsForUser(USER, { maxEntries: 2 });

    expect(db.listEntriesPendingEmbeddingSync).toHaveBeenCalledWith(USER, 2);
  });

  it("retries every pending entry and counts successes", async () => {
    db.listEntriesPendingEmbeddingSync.mockResolvedValue([
      pendingEntry("a"),
      pendingEntry("b"),
    ]);
    ai.syncEntryEmbeddings.mockResolvedValue({
      status: "retried",
      chunkCount: 1,
      embedded: 1,
    });

    await expect(syncPendingEmbeddingsForUser(USER)).resolves.toEqual({
      attempted: 2,
      succeeded: 2,
    });
    expect(ai.syncEntryEmbeddings).toHaveBeenCalledWith({
      entryId: "a",
      contentText: "entry a text",
      contentHash: "hash-a",
    });
    expect(ai.syncEntryEmbeddings).toHaveBeenCalledWith({
      entryId: "b",
      contentText: "entry b text",
      contentHash: "hash-b",
    });
  });

  it("does not count a failed sync as succeeded", async () => {
    db.listEntriesPendingEmbeddingSync.mockResolvedValue([pendingEntry("a")]);
    ai.syncEntryEmbeddings.mockResolvedValue({
      status: "failed",
      chunkCount: 1,
      embedded: 0,
      error: "OllamaUnavailableError",
    });

    await expect(syncPendingEmbeddingsForUser(USER)).resolves.toEqual({
      attempted: 1,
      succeeded: 0,
    });
  });

  it("keeps going when one entry throws, and still reports the rest", async () => {
    db.listEntriesPendingEmbeddingSync.mockResolvedValue([
      pendingEntry("a"),
      pendingEntry("b"),
    ]);
    ai.syncEntryEmbeddings
      .mockRejectedValueOnce(new Error("Ollama down"))
      .mockResolvedValueOnce({ status: "retried", chunkCount: 1, embedded: 1 });

    await expect(syncPendingEmbeddingsForUser(USER)).resolves.toEqual({
      attempted: 2,
      succeeded: 1,
    });
  });
});

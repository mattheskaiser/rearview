import { beforeEach, describe, expect, it, vi } from "vitest";

// Orchestration against an in-memory chunk store + mocked embedder.
// No real DB, no real Ollama; the deterministic chunker runs unchanged.

type Row = { id: string; entryId: string; index: number; text: string; hash: string; done: boolean };
const store = vi.hoisted(() => ({ rows: [] as Row[], seq: 0 }));
const of = (entryId: string) => store.rows.filter((r) => r.entryId === entryId);
const view = (entryId: string) =>
  of(entryId)
    .sort((a, b) => a.index - b.index)
    .map(({ id, index, text }) => ({ id, chunkIndex: index, text }));

vi.mock("@/lib/env", () => ({
  env: { OLLAMA_EMBEDDING_MODEL: "embed-model", OLLAMA_EMBEDDING_DIMENSIONS: 3 },
}));
vi.mock("@/lib/ai/embedding.service", () => ({ embedText: vi.fn() }));
vi.mock("@/lib/db/chunks", () => ({
  async replaceEntryChunks(entryId: string, hash: string, chunks: { chunkIndex: number; text: string }[]) {
    store.rows = store.rows.filter((r) => r.entryId !== entryId);
    for (const c of chunks) {
      store.rows.push({ id: `c${store.seq++}`, entryId, index: c.chunkIndex, text: c.text, hash, done: false });
    }
    return view(entryId);
  },
  async setChunkEmbedding({ chunkId }: { chunkId: string }) {
    const row = store.rows.find((r) => r.id === chunkId);
    if (row) row.done = true;
  },
  async deleteEntryChunks(entryId: string) {
    store.rows = store.rows.filter((r) => r.entryId !== entryId);
  },
  async listUnembeddedChunks(entryId: string) {
    return view(entryId).filter((c) => store.rows.some((r) => r.id === c.id && !r.done));
  },
  async getEntryChunkState(entryId: string) {
    const rows = of(entryId);
    return { sourceHash: rows[0]?.hash ?? null, total: rows.length, embedded: rows.filter((r) => r.done).length };
  },
}));

import { embedText } from "@/lib/ai/embedding.service";
import { syncEntryEmbeddings } from "@/lib/ai/entry-embeddings.service";

const embedMock = vi.mocked(embedText);
const twoParagraphs = `${"a ".repeat(600)}\n\n${"b ".repeat(600)}`;

beforeEach(() => {
  store.rows = [];
  store.seq = 0;
  embedMock.mockReset();
  embedMock.mockResolvedValue([0, 0, 0]);
});

describe("syncEntryEmbeddings", () => {
  it("chunks and embeds a brand-new entry", async () => {
    const result = await syncEntryEmbeddings({
      entryId: "e1",
      contentText: "A short first entry.",
      contentHash: "h1",
    });

    expect(result.status).toBe("regenerated");
    expect(result.embedded).toBe(result.chunkCount);
    expect(store.rows.every((r) => r.done && r.hash === "h1")).toBe(true);
  });

  it("does nothing when the hash is unchanged and every chunk is embedded", async () => {
    const input = { entryId: "e1", contentText: "Stable text.", contentHash: "h1" };
    await syncEntryEmbeddings(input);
    embedMock.mockClear();

    const result = await syncEntryEmbeddings(input);
    expect(result).toEqual({ status: "unchanged", chunkCount: 1, embedded: 0 });
    expect(embedMock).not.toHaveBeenCalled();
  });

  it("regenerates chunks when the content hash changes", async () => {
    await syncEntryEmbeddings({ entryId: "e1", contentText: "Original text.", contentHash: "h1" });
    const result = await syncEntryEmbeddings({
      entryId: "e1",
      contentText: "Completely different text now.",
      contentHash: "h2",
    });

    expect(result.status).toBe("regenerated");
    expect(store.rows.every((r) => r.hash === "h2" && r.done)).toBe(true);
  });

  it("leaves the work retryable after an embedding failure", async () => {
    embedMock
      .mockResolvedValueOnce([0, 0, 0])
      .mockRejectedValueOnce(Object.assign(new Error("down"), { name: "OllamaUnavailableError" }));

    const failure = await syncEntryEmbeddings({ entryId: "e2", contentText: twoParagraphs, contentHash: "h1" });
    expect(failure).toEqual({
      status: "failed",
      chunkCount: 2,
      embedded: 1,
      error: "OllamaUnavailableError",
    });

    embedMock.mockResolvedValue([0, 0, 0]);
    const retry = await syncEntryEmbeddings({ entryId: "e2", contentText: twoParagraphs, contentHash: "h1" });
    expect(retry.status).toBe("retried");
    expect(retry.chunkCount).toBe(1);
    expect(of("e2").every((r) => r.done)).toBe(true);
  });
});

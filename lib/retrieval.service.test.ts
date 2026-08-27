import { beforeEach, describe, expect, it, vi } from "vitest";

// Application-logic tests: the diversity reranker runs for real; the embedder
// and the vector query are mocked so nothing touches Ollama or Postgres.

const embedding = vi.hoisted(() => ({ embedText: vi.fn() }));
const chunkDb = vi.hoisted(() => ({ searchChunksByEmbedding: vi.fn() }));

vi.mock("@/lib/ai/embedding.service", () => embedding);
vi.mock("@/lib/db/chunks", () => chunkDb);

import {
  CANDIDATE_MULTIPLIER,
  DEFAULT_RESULT_LIMIT,
  rerankForDiversity,
  retrieve,
} from "@/lib/retrieval.service";

const match = (
  entryId: string,
  date: string,
  chunkIndex: number,
  distance: number,
) => ({
  entryId,
  journalDate: new Date(`${date}T00:00:00.000Z`),
  chunkIndex,
  text: `${entryId}#${chunkIndex}`,
  distance,
});

beforeEach(() => {
  vi.clearAllMocks();
  embedding.embedText.mockResolvedValue([0.1, 0.2, 0.3]);
});

describe("rerankForDiversity", () => {
  it("takes the closest chunk from each entry before a second from any entry", () => {
    const candidates = [
      match("a", "2022-01-01", 0, 0.1),
      match("a", "2022-01-01", 1, 0.12),
      match("a", "2022-01-01", 2, 0.13),
      match("b", "2022-02-02", 0, 0.2),
      match("c", "2022-03-03", 0, 0.3),
    ];

    const ranked = rerankForDiversity(candidates, 3);

    expect(ranked.map((c) => c.entryId)).toEqual(["a", "b", "c"]);
  });

  it("backfills spare slots up to the per-entry cap once every entry is represented", () => {
    const candidates = [
      match("a", "2022-01-01", 0, 0.1),
      match("a", "2022-01-01", 1, 0.11),
      match("a", "2022-01-01", 2, 0.12),
      match("b", "2022-02-02", 0, 0.2),
    ];

    const ranked = rerankForDiversity(candidates, 4, 2);

    // a, b in pass one; a again in pass two; a#2 excluded by the cap of 2.
    expect(ranked.map((c) => `${c.entryId}#${c.chunkIndex}`)).toEqual([
      "a#0",
      "b#0",
      "a#1",
    ]);
  });

  it("never returns more than the requested limit", () => {
    const candidates = Array.from({ length: 12 }, (_, i) =>
      match(`e${i}`, "2022-01-01", 0, i / 100),
    );

    expect(rerankForDiversity(candidates, 4)).toHaveLength(4);
  });
});

describe("retrieve", () => {
  it("embeds the question and over-fetches this user's candidates by the multiplier", async () => {
    chunkDb.searchChunksByEmbedding.mockResolvedValue([]);

    await retrieve("user-1", "how was my week?");

    expect(embedding.embedText).toHaveBeenCalledWith("how was my week?");
    expect(chunkDb.searchChunksByEmbedding).toHaveBeenCalledWith(
      "user-1",
      [0.1, 0.2, 0.3],
      DEFAULT_RESULT_LIMIT * CANDIDATE_MULTIPLIER,
      undefined,
    );
  });

  it("passes a normalized midnight-UTC date range through to the vector search", async () => {
    chunkDb.searchChunksByEmbedding.mockResolvedValue([]);

    await retrieve("user-1", "q", {
      dateRange: { from: "2024-01-01", to: "2024-12-31" },
    });

    const [, , , range] = chunkDb.searchChunksByEmbedding.mock.calls[0];
    expect(range.from.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2024-12-31T00:00:00.000Z");
  });

  it("treats an empty date range as no filter", async () => {
    chunkDb.searchChunksByEmbedding.mockResolvedValue([]);

    await retrieve("user-1", "q", { dateRange: {} });

    expect(chunkDb.searchChunksByEmbedding.mock.calls[0][3]).toBeUndefined();
  });

  it("returns diversified chunks with formatted dates, similarity and distinct entryDates", async () => {
    chunkDb.searchChunksByEmbedding.mockResolvedValue([
      match("a", "2022-01-01", 0, 0.1),
      match("a", "2022-01-01", 1, 0.15),
      match("b", "2022-02-02", 0, 0.2),
    ]);

    const result = await retrieve("user-1", "q", { limit: 2 });

    expect(result.chunks.map((c) => c.entryId)).toEqual(["a", "b"]);
    expect(result.chunks[0]).toMatchObject({
      journalDate: "2022-01-01",
      chunkIndex: 0,
      similarity: expect.closeTo(0.9, 5),
    });
    expect(result.entryDates).toEqual(["2022-01-01", "2022-02-02"]);
  });

  it("returns nothing when no chunks match", async () => {
    chunkDb.searchChunksByEmbedding.mockResolvedValue([]);

    const result = await retrieve("user-1", "q");

    expect(result).toEqual({ chunks: [], entryDates: [] });
  });
});

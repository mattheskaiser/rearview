import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ listEntryDates: vi.fn() }));
const retrieval = vi.hoisted(() => ({ retrieve: vi.fn() }));

vi.mock("@/lib/db/journal", () => db);
vi.mock("@/lib/retrieval.service", () => retrieval);

import { buildDateBuckets, retrieveBroad } from "@/lib/retrieval-broad.service";

describe("buildDateBuckets", () => {
  it("returns a single bucket for a short span", () => {
    expect(buildDateBuckets("2026-01-01", "2026-01-10")).toEqual([
      { from: "2026-01-01", to: "2026-01-10" },
    ]);
  });

  it("returns exactly one bucket for a single day", () => {
    expect(buildDateBuckets("2026-01-01", "2026-01-01")).toEqual([
      { from: "2026-01-01", to: "2026-01-01" },
    ]);
  });

  it("splits a year-long span into multiple contiguous buckets", () => {
    const buckets = buildDateBuckets("2025-01-01", "2025-12-31");

    expect(buckets.length).toBeGreaterThan(1);
    expect(buckets.length).toBeLessThanOrEqual(12);
    expect(buckets[0].from).toBe("2025-01-01");
    expect(buckets.at(-1)?.to).toBe("2025-12-31");
    // Contiguous: each bucket's `to` is the day before the next bucket's `from`.
    for (let i = 1; i < buckets.length; i++) {
      const prevTo = new Date(`${buckets[i - 1].to}T00:00:00Z`).getTime();
      const nextFrom = new Date(`${buckets[i].from}T00:00:00Z`).getTime();
      expect(nextFrom - prevTo).toBe(24 * 60 * 60 * 1000);
    }
  });

  it("caps bucket count at 12 even for a multi-year span", () => {
    const buckets = buildDateBuckets("2020-01-01", "2026-12-31");
    expect(buckets.length).toBeLessThanOrEqual(12);
    expect(buckets.at(-1)?.to).toBe("2026-12-31");
  });
});

const chunk = (entryId: string, journalDate: string, chunkIndex = 0) => ({
  entryId,
  journalDate,
  chunkIndex,
  text: `chunk ${entryId}`,
  similarity: 0.5,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("retrieveBroad", () => {
  it("returns empty results when the user has no entries", async () => {
    db.listEntryDates.mockResolvedValue([]);

    await expect(retrieveBroad("u", "q")).resolves.toEqual({
      chunks: [],
      entryDates: [],
      bucketCount: 0,
    });
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });

  it("queries once per bucket with a dateRange and merges results", async () => {
    db.listEntryDates.mockResolvedValue(["2026-01-01", "2026-06-15"]);
    retrieval.retrieve.mockResolvedValue({
      chunks: [chunk("a", "2026-01-05")],
      entryDates: ["2026-01-05"],
    });

    const result = await retrieveBroad("u", "patterns?");

    expect(retrieval.retrieve).toHaveBeenCalled();
    for (const call of retrieval.retrieve.mock.calls) {
      expect(call[0]).toBe("u");
      expect(call[1]).toBe("patterns?");
      expect(call[2]).toMatchObject({ limit: 3 });
      expect(call[2].dateRange).toBeDefined();
    }
    expect(result.bucketCount).toBe(retrieval.retrieve.mock.calls.length);
    // Every bucket returned the same chunk in this test — deduped.
    expect(result.chunks).toHaveLength(1);
  });

  it("de-duplicates a chunk that overlapping buckets both return", async () => {
    db.listEntryDates.mockResolvedValue(["2026-01-01", "2026-01-31"]);
    retrieval.retrieve.mockResolvedValue({
      chunks: [chunk("a", "2026-01-15"), chunk("a", "2026-01-15", 1)],
      entryDates: ["2026-01-15"],
    });

    const result = await retrieveBroad("u", "q");

    expect(result.chunks).toHaveLength(2); // distinct chunkIndex, both kept
    expect(result.entryDates).toEqual(["2026-01-15"]);
  });
});

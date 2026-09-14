import { beforeEach, describe, expect, it, vi } from "vitest";

const readiness = vi.hoisted(() => ({
  ensureOllamaReady: vi.fn(),
  OLLAMA_DOWN_MESSAGE: "OLLAMA_DOWN",
}));
const broad = vi.hoisted(() => ({ retrieveBroad: vi.fn() }));
const collected = vi.hoisted(() => ({ generateCollected: vi.fn() }));
const ollama = vi.hoisted(() => ({
  OllamaUnavailableError: class OllamaUnavailableError extends Error {},
}));

vi.mock("@/lib/ai/ollama-readiness.service", () => readiness);
vi.mock("@/lib/retrieval-broad.service", () => broad);
vi.mock("@/lib/ai/generate-collected", () => collected);
vi.mock("@/lib/ai/ollama.service", () => ollama);

import { runPatternAnalysis } from "@/lib/ai/pattern-analysis.service";

const chunk = (journalDate: string, text: string) => ({
  entryId: journalDate,
  journalDate,
  chunkIndex: 0,
  text,
  similarity: 0.5,
});

const VALID_RESPONSE = [
  "OBSERVATION: A recurring pattern.",
  "WHY: because.",
  "DATES: 2025-01-05",
  "COUNTEREXAMPLES: None noted.",
  "CONFIDENCE: strong",
].join("\n");

beforeEach(() => {
  vi.clearAllMocks();
  readiness.ensureOllamaReady.mockResolvedValue(null);
});

describe("runPatternAnalysis", () => {
  it("returns the readiness problem without retrieving when Ollama isn't ready", async () => {
    readiness.ensureOllamaReady.mockResolvedValue("model not pulled");

    const result = await runPatternAnalysis("u", "patterns?");

    expect(result).toEqual({ ok: false, error: "model not pulled" });
    expect(broad.retrieveBroad).not.toHaveBeenCalled();
  });

  it("returns a no-evidence error when broad retrieval finds nothing", async () => {
    broad.retrieveBroad.mockResolvedValue({ chunks: [], entryDates: [], bucketCount: 0 });

    const result = await runPatternAnalysis("u", "patterns?");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No journal entries");
    expect(collected.generateCollected).not.toHaveBeenCalled();
  });

  it("runs a single generation pass when evidence is small, and parses the result", async () => {
    broad.retrieveBroad.mockResolvedValue({
      chunks: [chunk("2025-01-05", "short entry")],
      entryDates: ["2025-01-05"],
      bucketCount: 1,
    });
    collected.generateCollected.mockResolvedValue(VALID_RESPONSE);

    const result = await runPatternAnalysis("u", "patterns?");

    expect(collected.generateCollected).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.observations).toHaveLength(1);
      expect(result.result.observations[0].supportingDates).toEqual(["2025-01-05"]);
      expect(result.entryDates).toEqual(["2025-01-05"]);
    }
  });

  it("map-reduces when evidence exceeds the single-pass budget", async () => {
    // Two chunks each ~7000 chars pushes total well past the 12,000 budget.
    const big = "x".repeat(7000);
    broad.retrieveBroad.mockResolvedValue({
      chunks: [chunk("2025-01-05", big), chunk("2025-06-01", big)],
      entryDates: ["2025-01-05", "2025-06-01"],
      bucketCount: 2,
    });
    collected.generateCollected
      .mockResolvedValueOnce("- candidate one (2025-01-05)") // batch 1 extraction
      .mockResolvedValueOnce("- candidate two (2025-06-01)") // batch 2 extraction
      .mockResolvedValueOnce(VALID_RESPONSE); // final reduce pass

    const result = await runPatternAnalysis("u", "patterns?");

    // 2 extraction calls (one per ~7000-char batch, since 4000-char budget
    // fits one big chunk per batch) + 1 final reduce call.
    expect(collected.generateCollected).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(true);
  });

  it("maps an Ollama-unavailable failure mid-generation to the down message", async () => {
    broad.retrieveBroad.mockResolvedValue({
      chunks: [chunk("2025-01-05", "short entry")],
      entryDates: ["2025-01-05"],
      bucketCount: 1,
    });
    collected.generateCollected.mockRejectedValue(new ollama.OllamaUnavailableError("down"));

    const result = await runPatternAnalysis("u", "patterns?");

    expect(result).toEqual({ ok: false, error: "OLLAMA_DOWN" });
  });

  it("maps any other generation failure to a generic message", async () => {
    broad.retrieveBroad.mockResolvedValue({
      chunks: [chunk("2025-01-05", "short entry")],
      entryDates: ["2025-01-05"],
      bucketCount: 1,
    });
    collected.generateCollected.mockRejectedValue(new Error("boom"));

    const result = await runPatternAnalysis("u", "patterns?");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Something went wrong");
  });
});

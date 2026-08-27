import { beforeEach, describe, expect, it, vi } from "vitest";

// Application-logic tests for the reflection boundary. Retrieval and generation
// are mocked; the real validation, card mapping and limit clamping run. Nothing
// touches Postgres or Ollama.

vi.mock("@/lib/env", () => ({
  env: {
    OLLAMA_BASE_URL: "http://ollama.test",
    OLLAMA_GENERATION_MODEL: "gen-model",
    EMBEDDING_MODEL: "embed-model",
    EMBEDDING_DIMENSIONS: 3,
  },
}));

const retrieval = vi.hoisted(() => ({ retrieve: vi.fn() }));
const answer = vi.hoisted(() => ({ streamAnswer: vi.fn() }));

vi.mock("@/lib/retrieval.service", () => retrieval);
vi.mock("@/lib/ai/answer.service", () => answer);

import { OllamaUnavailableError } from "@/lib/ai/ollama.service";
import {
  MAX_EVIDENCE_LIMIT,
  retrieveEvidence,
  streamReflection,
} from "@/lib/reflection.service";

const chunk = (journalDate: string, text: string, chunkIndex = 0) => ({
  entryId: journalDate,
  journalDate,
  chunkIndex,
  text,
  similarity: 0.9,
});

async function* frames(list: unknown[]): AsyncGenerator<unknown> {
  for (const item of list) yield item;
}

async function drain(gen: AsyncGenerator<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const event of gen) out.push(event);
  return out;
}

beforeEach(() => vi.clearAllMocks());

describe("retrieveEvidence", () => {
  it("rejects an empty question without retrieving", async () => {
    const result = await retrieveEvidence("u", "   ");
    expect(result.ok).toBe(false);
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });

  it("returns one dated, preview-trimmed card per distinct entry", async () => {
    retrieval.retrieve.mockResolvedValue({
      chunks: [
        chunk("2024-01-19", "a".repeat(400)),
        chunk("2024-01-19", "same day, later chunk", 1),
        chunk("2022-07-23", "short one"),
      ],
      entryDates: [],
    });

    const result = await retrieveEvidence("u", "spanish?");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.evidence.map((e) => e.date)).toEqual([
        "2024-01-19",
        "2022-07-23",
      ]);
      expect(result.evidence[0].preview.length).toBeLessThanOrEqual(151);
      expect(result.evidence[0].preview.endsWith("…")).toBe(true);
      expect(result.evidence[1].preview).toBe("short one");
    }
  });

  it("clamps a runaway limit into the bounded range", async () => {
    retrieval.retrieve.mockResolvedValue({ chunks: [], entryDates: [] });
    await retrieveEvidence("u", "q", 999);
    expect(retrieval.retrieve).toHaveBeenCalledWith("u", "q", {
      limit: MAX_EVIDENCE_LIMIT,
    });
  });
});

describe("streamReflection", () => {
  it("emits the NO_EVIDENCE error and never generates when retrieval is empty", async () => {
    retrieval.retrieve.mockResolvedValue({ chunks: [], entryDates: [] });

    const out = await drain(streamReflection("u", "q"));

    expect(out).toEqual([
      { type: "error", error: expect.stringContaining("No journal entries") },
    ]);
    expect(answer.streamAnswer).not.toHaveBeenCalled();
  });

  it("emits an evidence frame first, then forwards answer tokens and done", async () => {
    retrieval.retrieve.mockResolvedValue({
      chunks: [chunk("2022-03-04", "note")],
      entryDates: [],
    });
    answer.streamAnswer.mockReturnValue(
      frames([
        { type: "token", value: "A" },
        { type: "done" },
      ]),
    );

    const out = await drain(streamReflection("u", "career?"));

    expect(out).toEqual([
      {
        type: "evidence",
        evidence: [
          expect.objectContaining({ date: "2022-03-04", preview: "note" }),
        ],
      },
      { type: "token", value: "A" },
      { type: "done" },
    ]);
    expect(answer.streamAnswer).toHaveBeenCalledWith(
      "career?",
      [{ journalDate: "2022-03-04", text: "note" }],
      undefined,
    );
  });

  it("ends silently after an aborted answer, keeping earlier frames", async () => {
    retrieval.retrieve.mockResolvedValue({
      chunks: [chunk("2022-03-04", "note")],
      entryDates: [],
    });
    answer.streamAnswer.mockReturnValue(
      frames([
        { type: "token", value: "partial" },
        { type: "aborted" },
      ]),
    );

    const out = await drain(streamReflection("u", "q"));

    expect(out).toEqual([
      { type: "evidence", evidence: expect.any(Array) },
      { type: "token", value: "partial" },
    ]);
  });

  it("maps an ollama-unavailable answer reason to the down message", async () => {
    retrieval.retrieve.mockResolvedValue({
      chunks: [chunk("2022-03-04", "note")],
      entryDates: [],
    });
    answer.streamAnswer.mockReturnValue(
      frames([{ type: "error", reason: "ollama-unavailable" }]),
    );

    const out = await drain(streamReflection("u", "q"));

    expect(out.at(-1)).toEqual({
      type: "error",
      error: expect.stringContaining("not reachable"),
    });
  });

  it("surfaces a retrieval failure as the down message", async () => {
    retrieval.retrieve.mockRejectedValue(new OllamaUnavailableError("down"));

    const out = await drain(streamReflection("u", "q"));

    expect(out).toEqual([
      { type: "error", error: expect.stringContaining("not reachable") },
    ]);
  });
});

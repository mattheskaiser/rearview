import { beforeEach, describe, expect, it, vi } from "vitest";

// Application-logic tests for the Memories boundary. Retrieval, generation and
// persistence are mocked; the real validation and snapshot mapping run. Nothing
// touches Postgres or Ollama.

vi.mock("@/lib/env", () => ({
  env: {
    OLLAMA_BASE_URL: "http://ollama.test",
    OLLAMA_GENERATION_MODEL: "gen-model",
    OLLAMA_EMBEDDING_MODEL: "embed-model",
    OLLAMA_EMBEDDING_DIMENSIONS: 3,
  },
}));

const retrieval = vi.hoisted(() => ({ retrieve: vi.fn() }));
const answer = vi.hoisted(() => ({ generateAnswer: vi.fn() }));
const memoryDb = vi.hoisted(() => ({
  createMemory: vi.fn(),
  listMemories: vi.fn(),
  deleteMemory: vi.fn(),
}));
const journalDb = vi.hoisted(() => ({ getEntriesByDates: vi.fn() }));

vi.mock("@/lib/retrieval.service", () => retrieval);
vi.mock("@/lib/ai/answer.service", () => answer);
vi.mock("@/lib/db/memory", () => memoryDb);
vi.mock("@/lib/db/journal", () => journalDb);

import {
  askJournal,
  listSavedMemories,
  removeMemory,
  saveMemory,
} from "@/lib/memory.service";

const utc = (date: string) => new Date(`${date}T00:00:00.000Z`);
const chunk = (entryId: string, journalDate: string, text: string) => ({
  entryId,
  journalDate,
  chunkIndex: 0,
  text,
  similarity: 0.9,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("askJournal", () => {
  it("rejects an empty question without retrieving anything", async () => {
    const result = await askJournal("   ");

    expect(result.ok).toBe(false);
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });

  it("returns an empty-results state when nothing was retrieved", async () => {
    retrieval.retrieve.mockResolvedValue({ chunks: [], entryDates: [] });

    const result = await askJournal("what did I learn?");

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("No journal entries"),
    });
    expect(answer.generateAnswer).not.toHaveBeenCalled();
  });

  it("synthesizes from retrieved evidence and returns dated evidence", async () => {
    retrieval.retrieve.mockResolvedValue({
      chunks: [
        chunk("a", "2022-03-04", "uncertain about the role"),
        chunk("b", "2022-05-19", "wanted more ownership"),
      ],
      entryDates: ["2022-03-04", "2022-05-19"],
    });
    answer.generateAnswer.mockResolvedValue({
      ok: true,
      answer: "You wrestled with growth versus stability.",
    });

    const result = await askJournal("career?");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reflection).toEqual({
        question: "career?",
        answer: "You wrestled with growth versus stability.",
        evidence: [
          { date: "2022-03-04", label: "Mar 4, 2022" },
          { date: "2022-05-19", label: "May 19, 2022" },
        ],
      });
    }
    expect(answer.generateAnswer).toHaveBeenCalledWith("career?", [
      { journalDate: "2022-03-04", text: "uncertain about the role" },
      { journalDate: "2022-05-19", text: "wanted more ownership" },
    ]);
  });

  it("surfaces an Ollama-down state instead of throwing", async () => {
    retrieval.retrieve.mockResolvedValue({
      chunks: [chunk("a", "2022-03-04", "x")],
      entryDates: ["2022-03-04"],
    });
    answer.generateAnswer.mockResolvedValue({
      ok: false,
      reason: "ollama-unavailable",
    });

    const result = await askJournal("q");

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("not reachable"),
    });
  });
});

describe("saveMemory", () => {
  it("persists the question, answer and a dated snapshot of the cited entries", async () => {
    journalDb.getEntriesByDates.mockResolvedValue([
      { id: "e-a", journalDate: utc("2022-03-04") },
    ]);
    memoryDb.createMemory.mockResolvedValue({
      id: "m1",
      question: "career?",
      answer: "A grounded answer.",
      createdAt: utc("2023-01-12"),
      entries: [{ journalDate: utc("2022-03-04") }],
    });

    const result = await saveMemory({
      question: "career?",
      answer: "A grounded answer.",
      dates: ["2022-03-04", "2022-08-02", "2022-03-04"],
    });

    expect(result.ok).toBe(true);
    const written = memoryDb.createMemory.mock.calls[0][0];
    expect(written.question).toBe("career?");
    // Deduped; missing entry recorded with a null id (snapshot still kept).
    expect(written.entries).toEqual([
      { entryId: "e-a", journalDate: utc("2022-03-04") },
      { entryId: null, journalDate: utc("2022-08-02") },
    ]);
  });

  it("rejects an empty answer without touching the database", async () => {
    const result = await saveMemory({ question: "q", answer: "  ", dates: [] });

    expect(result.ok).toBe(false);
    expect(memoryDb.createMemory).not.toHaveBeenCalled();
  });
});

describe("listSavedMemories", () => {
  it("maps stored memories to dated reflections with sorted evidence", async () => {
    memoryDb.listMemories.mockResolvedValue([
      {
        id: "m1",
        question: "Q?",
        answer: "A.",
        createdAt: new Date("2023-03-02T18:45:00.000Z"),
        entries: [
          { journalDate: utc("2022-06-24") },
          { journalDate: utc("2022-02-01") },
        ],
      },
    ]);

    const [memory] = await listSavedMemories();

    expect(memory).toEqual({
      id: "m1",
      question: "Q?",
      answer: "A.",
      savedAt: "2023-03-02T18:45:00.000Z",
      evidence: [
        { date: "2022-02-01", label: "Feb 1, 2022" },
        { date: "2022-06-24", label: "Jun 24, 2022" },
      ],
    });
  });
});

describe("removeMemory", () => {
  it("deletes by id", async () => {
    memoryDb.deleteMemory.mockResolvedValue({});

    const result = await removeMemory("m1");

    expect(result).toEqual({ ok: true });
    expect(memoryDb.deleteMemory).toHaveBeenCalledWith("m1");
  });

  it("rejects a missing id without touching the database", async () => {
    const result = await removeMemory("");

    expect(result.ok).toBe(false);
    expect(memoryDb.deleteMemory).not.toHaveBeenCalled();
  });
});

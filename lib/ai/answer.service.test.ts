import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    OLLAMA_BASE_URL: "http://ollama.test",
    OLLAMA_GENERATION_MODEL: "gen-model",
    EMBEDDING_MODEL: "embed-model",
    EMBEDDING_DIMENSIONS: 3,
  },
}));

// The real Ollama error taxonomy is kept; only the transport calls are mocked,
// so no request ever leaves the process.
vi.mock("@/lib/ai/ollama.service", async (importActual) => {
  const actual =
    await importActual<typeof import("@/lib/ai/ollama.service")>();
  return { ...actual, generate: vi.fn() };
});
vi.mock("@/lib/ai/ollama-stream.service", async (importActual) => {
  const actual =
    await importActual<typeof import("@/lib/ai/ollama-stream.service")>();
  return { ...actual, generateStream: vi.fn() };
});

import { generateAnswer, streamAnswer } from "@/lib/ai/answer.service";
import { generateStream } from "@/lib/ai/ollama-stream.service";
import {
  OllamaResponseError,
  OllamaUnavailableError,
  generate,
} from "@/lib/ai/ollama.service";

const generateMock = vi.mocked(generate);
const streamMock = vi.mocked(generateStream);
const evidence = [{ journalDate: "2022-03-04", text: "a journal note" }];

async function* tokens(values: string[]): AsyncGenerator<string> {
  for (const value of values) yield value;
}

async function drain(gen: AsyncGenerator<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const event of gen) out.push(event);
  return out;
}

afterEach(() => vi.clearAllMocks());

describe("generateAnswer", () => {
  it("returns no-evidence without calling Ollama when there is nothing to synthesize", async () => {
    const result = await generateAnswer("q", []);

    expect(result).toEqual({ ok: false, reason: "no-evidence" });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("passes the grounding system prompt and returns the trimmed answer", async () => {
    generateMock.mockResolvedValue("  Your journal says you felt stretched.  ");

    const result = await generateAnswer("how did I feel?", evidence);

    expect(result).toEqual({
      ok: true,
      answer: "Your journal says you felt stretched.",
    });
    const [, options] = generateMock.mock.calls[0];
    expect(options?.system?.toLowerCase()).toContain("source of truth");
  });

  it("reports ollama-unavailable when Ollama cannot be reached", async () => {
    generateMock.mockRejectedValue(new OllamaUnavailableError("down"));

    await expect(generateAnswer("q", evidence)).resolves.toEqual({
      ok: false,
      reason: "ollama-unavailable",
    });
  });

  it("reports generation-failed on a bad Ollama response", async () => {
    generateMock.mockRejectedValue(new OllamaResponseError("bad", 500));

    await expect(generateAnswer("q", evidence)).resolves.toEqual({
      ok: false,
      reason: "generation-failed",
    });
  });

  it("reports generation-failed when the model returns only whitespace", async () => {
    generateMock.mockResolvedValue("   ");

    await expect(generateAnswer("q", evidence)).resolves.toEqual({
      ok: false,
      reason: "generation-failed",
    });
  });
});

describe("streamAnswer", () => {
  it("yields a no-evidence error without calling Ollama", async () => {
    expect(await drain(streamAnswer("q", []))).toEqual([
      { type: "error", reason: "no-evidence" },
    ]);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("streams tokens then done, with the grounding system prompt", async () => {
    streamMock.mockReturnValue(tokens(["Your ", "journal ", "says…"]));

    expect(await drain(streamAnswer("how did I feel?", evidence))).toEqual([
      { type: "token", value: "Your " },
      { type: "token", value: "journal " },
      { type: "token", value: "says…" },
      { type: "done" },
    ]);
    const [, options] = streamMock.mock.calls[0];
    expect(options?.system?.toLowerCase()).toContain("source of truth");
  });

  it("reports generation-failed when no token ever arrives", async () => {
    streamMock.mockReturnValue(tokens([]));

    expect(await drain(streamAnswer("q", evidence))).toEqual([
      { type: "error", reason: "generation-failed" },
    ]);
  });

  it("maps an unreachable Ollama to ollama-unavailable", async () => {
    streamMock.mockImplementation(async function* () {
      throw new OllamaUnavailableError("down");
    });

    expect(await drain(streamAnswer("q", evidence))).toEqual([
      { type: "error", reason: "ollama-unavailable" },
    ]);
  });

  it("maps a bad Ollama response to generation-failed", async () => {
    streamMock.mockImplementation(async function* () {
      throw new OllamaResponseError("bad", 500);
    });

    expect(await drain(streamAnswer("q", evidence))).toEqual([
      { type: "error", reason: "generation-failed" },
    ]);
  });

  it("yields aborted (keeping streamed text) when generation is stopped", async () => {
    streamMock.mockImplementation(async function* () {
      yield "partial";
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });

    expect(await drain(streamAnswer("q", evidence))).toEqual([
      { type: "token", value: "partial" },
      { type: "aborted" },
    ]);
  });

  it("never re-throws — an unknown mid-stream error becomes generation-failed", async () => {
    streamMock.mockImplementation(async function* () {
      yield "partial";
      throw new Error("kaboom");
    });

    expect(await drain(streamAnswer("q", evidence))).toEqual([
      { type: "token", value: "partial" },
      { type: "error", reason: "generation-failed" },
    ]);
  });

  it("treats a token stall as ollama-unavailable without a total timeout", async () => {
    vi.useFakeTimers();
    streamMock.mockReturnValue(
      (async function* () {
        await new Promise(() => {}); // a token that never arrives
        yield "unreachable";
      })(),
    );

    const events: unknown[] = [];
    const run = (async () => {
      for await (const event of streamAnswer("q", evidence)) events.push(event);
    })();

    await vi.advanceTimersByTimeAsync(60_000);
    await run;

    expect(events).toEqual([{ type: "error", reason: "ollama-unavailable" }]);
    vi.useRealTimers();
  });
});

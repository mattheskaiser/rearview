import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    OLLAMA_BASE_URL: "http://ollama.test",
    OLLAMA_GENERATION_MODEL: "gen-model",
    EMBEDDING_MODEL: "embed-model",
    EMBEDDING_DIMENSIONS: 3,
  },
}));

vi.mock("@/lib/ai/ollama-stream.service", async (importActual) => {
  const actual =
    await importActual<typeof import("@/lib/ai/ollama-stream.service")>();
  return { ...actual, generateStream: vi.fn() };
});

import { generateCollected } from "@/lib/ai/generate-collected";
import { generateStream } from "@/lib/ai/ollama-stream.service";
import { OllamaUnavailableError } from "@/lib/ai/ollama.service";

const streamMock = vi.mocked(generateStream);

async function* tokens(values: string[]): AsyncGenerator<string> {
  for (const value of values) yield value;
}

afterEach(() => vi.clearAllMocks());

describe("generateCollected", () => {
  it("concatenates every streamed token into one string", async () => {
    streamMock.mockReturnValue(tokens(["The ", "pattern ", "is..."]));

    await expect(generateCollected("prompt")).resolves.toBe(
      "The pattern is...",
    );
  });

  it("returns an empty string when the stream produces nothing", async () => {
    streamMock.mockReturnValue(tokens([]));

    await expect(generateCollected("prompt")).resolves.toBe("");
  });

  it("propagates a transport failure from the stream", async () => {
    streamMock.mockReturnValue(
      (async function* () {
        throw new OllamaUnavailableError("down");
      })(),
    );

    await expect(generateCollected("prompt")).rejects.toBeInstanceOf(
      OllamaUnavailableError,
    );
  });

  it("has no total timeout — a slow-but-steady stream is not cut off", async () => {
    vi.useFakeTimers();
    streamMock.mockReturnValue(
      (async function* () {
        yield "a";
        await new Promise((resolve) => setTimeout(resolve, 50_000));
        yield "b";
      })(),
    );

    const run = generateCollected("prompt");
    await vi.advanceTimersByTimeAsync(50_000);
    await expect(run).resolves.toBe("ab");
    vi.useRealTimers();
  });

  it("fails as ollama-unavailable after 60s with no new token (stall, not total timeout)", async () => {
    vi.useFakeTimers();
    streamMock.mockReturnValue(
      (async function* () {
        yield "a";
        await new Promise(() => {}); // a token that never arrives
        yield "unreachable";
      })(),
    );

    const run = generateCollected("prompt");
    const assertion = expect(run).rejects.toBeInstanceOf(OllamaUnavailableError);
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    vi.useRealTimers();
  });
});

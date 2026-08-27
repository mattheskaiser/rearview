import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    OLLAMA_BASE_URL: "http://ollama.test",
    OLLAMA_GENERATION_MODEL: "gen-model",
    EMBEDDING_MODEL: "embed-model",
    EMBEDDING_DIMENSIONS: 3,
  },
}));

// The real Ollama error taxonomy is kept; only `generate` is mocked, so no
// request ever leaves the process.
vi.mock("@/lib/ai/ollama.service", async (importActual) => {
  const actual =
    await importActual<typeof import("@/lib/ai/ollama.service")>();
  return { ...actual, generate: vi.fn() };
});

import { generateAnswer } from "@/lib/ai/answer.service";
import {
  OllamaResponseError,
  OllamaUnavailableError,
  generate,
} from "@/lib/ai/ollama.service";

const generateMock = vi.mocked(generate);
const evidence = [{ journalDate: "2022-03-04", text: "a journal note" }];

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

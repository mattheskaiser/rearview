import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    OLLAMA_BASE_URL: "http://ollama.test",
    OLLAMA_GENERATION_MODEL: "llama3.1",
    EMBEDDING_MODEL: "bge-m3",
  },
}));

// The real `ollamaFetch` runs; only the network is stubbed, mirroring
// ollama.service.test.ts. That keeps the transport-error mapping under test and
// avoids a mock that throws.
import { checkOllamaHealth } from "@/lib/ai/ollama-health.service";

const tags = (names: string[], ok = true) =>
  ({
    ok,
    json: async () => ({ models: names.map((name) => ({ name })) }),
  }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("checkOllamaHealth", () => {
  it("reports both models available, matching a name with or without a :tag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(tags(["llama3.1:latest", "bge-m3:latest"])),
    );

    await expect(checkOllamaHealth()).resolves.toEqual({
      reachable: true,
      generation: { model: "llama3.1", available: true },
      embedding: { model: "bge-m3", available: true },
    });
  });

  it("flags a configured model that is not pulled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(tags(["llama3.1:latest"])),
    );

    const health = await checkOllamaHealth();
    expect(health.generation.available).toBe(true);
    expect(health.embedding.available).toBe(false);
  });

  it("returns an unreachable result when Ollama cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(checkOllamaHealth()).resolves.toEqual({
      reachable: false,
      generation: { model: "llama3.1", available: false },
      embedding: { model: "bge-m3", available: false },
    });
  });

  it("returns an unreachable result on a non-2xx probe response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(tags([], false)));

    await expect(checkOllamaHealth()).resolves.toMatchObject({ reachable: false });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    OLLAMA_BASE_URL: "http://ollama.test",
    OLLAMA_GENERATION_MODEL: "gen-model",
    OLLAMA_EMBEDDING_MODEL: "embed-model",
    OLLAMA_EMBEDDING_DIMENSIONS: 3,
  },
}));

import {
  OllamaResponseError,
  OllamaUnavailableError,
  embed,
  generate,
} from "@/lib/ai/ollama.service";

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("generate", () => {
  it("posts the configured model and returns the completion text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ response: "hello" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generate("hi", { temperature: 0.1 })).resolves.toBe("hello");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://ollama.test/api/generate");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.model).toBe("gen-model");
    expect(sent.stream).toBe(false);
    expect(sent.options).toEqual({ temperature: 0.1 });
  });

  it("throws OllamaUnavailableError when the request cannot be made", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(generate("hi")).rejects.toBeInstanceOf(OllamaUnavailableError);
  });

  it("throws OllamaResponseError with the status on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false, 503)));
    const error = await generate("hi").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OllamaResponseError);
    expect((error as OllamaResponseError).status).toBe(503);
  });

  it("throws OllamaResponseError when the body has no response text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ response: 42 })));
    await expect(generate("hi")).rejects.toBeInstanceOf(OllamaResponseError);
  });
});

describe("embed", () => {
  it("returns the vectors from a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ embeddings: [[1, 2, 3]] })),
    );
    await expect(embed("text")).resolves.toEqual([[1, 2, 3]]);
  });

  it("throws OllamaResponseError when no embeddings come back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ embeddings: [] })),
    );
    await expect(embed("text")).rejects.toBeInstanceOf(OllamaResponseError);
  });

  it("throws OllamaUnavailableError when Ollama is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(embed(["a", "b"])).rejects.toBeInstanceOf(OllamaUnavailableError);
  });
});

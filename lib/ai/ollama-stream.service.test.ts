import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    OLLAMA_BASE_URL: "http://ollama.test",
    OLLAMA_GENERATION_MODEL: "gen-model",
    EMBEDDING_MODEL: "embed-model",
    EMBEDDING_DIMENSIONS: 3,
  },
}));

import { generateStream } from "@/lib/ai/ollama-stream.service";
import {
  OllamaResponseError,
  OllamaUnavailableError,
} from "@/lib/ai/ollama.service";

const encoder = new TextEncoder();

const streamOf = (body: string): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });

const response = (init: {
  ok?: boolean;
  status?: number;
  body?: unknown;
}): Response => ({ ok: true, status: 200, ...init }) as unknown as Response;

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const token of gen) out.push(token);
  return out;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("generateStream", () => {
  it("streams response deltas, sends stream:true, stops at done", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        body: streamOf(
          '{"response":"Hel","done":false}\n' +
            '{"response":"lo","done":false}\n' +
            '{"response":"","done":true}\n',
        ),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await collect(generateStream("hi", { temperature: 0.2 }))).toEqual([
      "Hel",
      "lo",
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://ollama.test/api/generate");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.stream).toBe(true);
    expect(sent.model).toBe("gen-model");
    expect(sent.options).toEqual({ temperature: 0.2 });
  });

  it("tolerates a token split across two byte chunks", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"response":"ab'));
        controller.enqueue(encoder.encode('c","done":false}\n{"done":true}\n'));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ body })));

    expect(await collect(generateStream("hi"))).toEqual(["abc"]);
  });

  it("maps a transport failure to OllamaUnavailableError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(collect(generateStream("hi"))).rejects.toBeInstanceOf(
      OllamaUnavailableError,
    );
  });

  it("throws OllamaResponseError on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ok: false, status: 503, body: streamOf("") })),
    );
    await expect(collect(generateStream("hi"))).rejects.toBeInstanceOf(
      OllamaResponseError,
    );
  });

  it("maps a mid-stream body failure to OllamaUnavailableError, not a raw throw", async () => {
    let sent = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sent) {
          sent = true;
          controller.enqueue(encoder.encode('{"response":"a","done":false}\n'));
        } else {
          controller.error(new Error("terminated"));
        }
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ body })));

    const out: string[] = [];
    await expect(
      (async () => {
        for await (const token of generateStream("hi")) out.push(token);
      })(),
    ).rejects.toBeInstanceOf(OllamaUnavailableError);
    expect(out).toEqual(["a"]);
  });

  it("propagates an abort instead of masking it as unavailable", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    await expect(collect(generateStream("hi"))).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

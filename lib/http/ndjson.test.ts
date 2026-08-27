import { describe, expect, it } from "vitest";

import { ndjsonLines, ndjsonStream } from "@/lib/http/ndjson";

async function* source(items: unknown[]): AsyncGenerator<unknown> {
  for (const item of items) yield item;
}

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const line of gen) out.push(line);
  return out;
}

const streamOf = (...chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
};

describe("ndjson", () => {
  it("encodes values as newline-delimited JSON and decodes them back", async () => {
    const events = [
      { type: "evidence", n: 1 },
      { type: "token", value: "hi" },
      { type: "done" },
    ];

    const lines = await collect(ndjsonLines(ndjsonStream(source(events))));

    expect(lines.map((line) => JSON.parse(line))).toEqual(events);
  });

  it("reassembles a line split across byte chunks", async () => {
    const lines = await collect(streamLines('{"a":1}\n{"b":', "2}\n"));
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("yields a trailing line that has no newline", async () => {
    expect(await collect(streamLines('{"x":1}'))).toEqual(['{"x":1}']);
  });

  it("skips blank lines", async () => {
    expect(await collect(streamLines("a\n\n\nb\n"))).toEqual(["a", "b"]);
  });
});

const streamLines = (...chunks: string[]) => ndjsonLines(streamOf(...chunks));

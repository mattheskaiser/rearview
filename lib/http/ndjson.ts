/**
 * Newline-delimited JSON over a byte stream. Pure Web APIs, no framework and no
 * `server-only` marker: the encoder runs in the reflection Route Handler, the
 * decoder runs in the browser hook that reads it back.
 */

/** Split a byte stream into trimmed, non-empty text lines as they arrive. */
export async function* ndjsonLines(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield line;
      }
    }
    const tail = buffer.trim();
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

/** Encode an async sequence of JSON-serializable values as an NDJSON byte stream. */
export function ndjsonStream(
  events: AsyncIterable<unknown>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();

  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch (error) {
        // The consumer may already be gone (client disconnect); never let this
        // reject `pull`, which would surface as an unhandled rejection.
        try {
          controller.error(error);
        } catch {
          /* stream already closed */
        }
      }
    },
    async cancel() {
      try {
        await iterator.return?.(undefined);
      } catch {
        /* generator cleanup raced a close — nothing to do */
      }
    },
  });
}

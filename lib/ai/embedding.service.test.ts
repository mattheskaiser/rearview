import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { OLLAMA_EMBEDDING_MODEL: "embed-model", OLLAMA_EMBEDDING_DIMENSIONS: 3 },
}));
vi.mock("@/lib/ai/ollama.service", () => ({ embed: vi.fn() }));

import { embed } from "@/lib/ai/ollama.service";
import {
  EmbeddingDimensionError,
  embedMany,
  embedText,
} from "@/lib/ai/embedding.service";

const embedMock = vi.mocked(embed);

beforeEach(() => embedMock.mockReset());

describe("embedText", () => {
  it("returns the vector when its length matches the configured dimensions", async () => {
    embedMock.mockResolvedValue([[0.1, 0.2, 0.3]]);
    await expect(embedText("hi")).resolves.toEqual([0.1, 0.2, 0.3]);
  });

  it("throws EmbeddingDimensionError on a dimension mismatch", async () => {
    embedMock.mockResolvedValue([[0.1, 0.2]]);
    const error = await embedText("hi").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmbeddingDimensionError);
    expect(error).toMatchObject({ expected: 3, actual: 2 });
  });
});

describe("embedMany", () => {
  it("short-circuits on an empty list without calling Ollama", async () => {
    await expect(embedMany([])).resolves.toEqual([]);
    expect(embedMock).not.toHaveBeenCalled();
  });

  it("returns one validated vector per input, in order", async () => {
    embedMock.mockResolvedValue([
      [1, 1, 1],
      [2, 2, 2],
    ]);
    await expect(embedMany(["a", "b"])).resolves.toEqual([
      [1, 1, 1],
      [2, 2, 2],
    ]);
  });

  it("throws when the number of vectors does not match the number of texts", async () => {
    embedMock.mockResolvedValue([[1, 1, 1]]);
    await expect(embedMany(["a", "b"])).rejects.toThrow(/received 1/);
  });

  it("throws EmbeddingDimensionError if any vector has the wrong size", async () => {
    embedMock.mockResolvedValue([
      [1, 1, 1],
      [2, 2],
    ]);
    await expect(embedMany(["a", "b"])).rejects.toBeInstanceOf(
      EmbeddingDimensionError,
    );
  });
});

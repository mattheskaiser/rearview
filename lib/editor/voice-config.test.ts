import { afterEach, describe, expect, it, vi } from "vitest";

describe("VOICE_MODEL_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falls back to a multilingual quantized default when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_MODEL_URL", "");
    const { VOICE_MODEL_URL } = await import("./voice-config");
    expect(VOICE_MODEL_URL).toBe(
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
    );
  });

  it("uses NEXT_PUBLIC_VOICE_MODEL_URL when provided, trimmed", async () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_MODEL_URL", "  https://example.com/ggml-tiny-q5_1.bin  ");
    const { VOICE_MODEL_URL } = await import("./voice-config");
    expect(VOICE_MODEL_URL).toBe("https://example.com/ggml-tiny-q5_1.bin");
  });
});

describe("VOICE_MODEL_SIZE_MB", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to the base model's approximate size", async () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_MODEL_SIZE_MB", "");
    const { VOICE_MODEL_SIZE_MB } = await import("./voice-config");
    expect(VOICE_MODEL_SIZE_MB).toBe(57);
  });

  it("uses NEXT_PUBLIC_VOICE_MODEL_SIZE_MB when provided", async () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_MODEL_SIZE_MB", "30");
    const { VOICE_MODEL_SIZE_MB } = await import("./voice-config");
    expect(VOICE_MODEL_SIZE_MB).toBe(30);
  });
});

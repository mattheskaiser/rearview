import { afterEach, describe, expect, it, vi } from "vitest";

describe("VOICE_MODEL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falls back to a multilingual default when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_MODEL", "");
    const { VOICE_MODEL } = await import("./voice-config");
    expect(VOICE_MODEL).toBe("onnx-community/whisper-base");
  });

  it("uses NEXT_PUBLIC_VOICE_MODEL when provided, trimmed", async () => {
    vi.stubEnv("NEXT_PUBLIC_VOICE_MODEL", "  onnx-community/whisper-small  ");
    const { VOICE_MODEL } = await import("./voice-config");
    expect(VOICE_MODEL).toBe("onnx-community/whisper-small");
  });
});

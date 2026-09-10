/**
 * Voice-to-text model — configuration, never hardcoded (CLAUDE.md > AI).
 *
 * Speech recognition (Whisper) runs entirely in the browser through a Web
 * Worker: no audio and no transcript ever leave the machine, not even to
 * Rearview's own server. Set `NEXT_PUBLIC_VOICE_MODEL` to swap the model; the
 * default is multilingual and covers English + German.
 *
 * `NEXT_PUBLIC_` is required because the value is read in client/worker code —
 * it is a public model identifier, not a secret.
 */
export const VOICE_MODEL =
  process.env.NEXT_PUBLIC_VOICE_MODEL?.trim() || "onnx-community/whisper-base";

/** Sample rate the Whisper feature extractor expects (16 kHz mono). */
export const WHISPER_SAMPLE_RATE = 16_000;

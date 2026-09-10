/**
 * Voice-to-text configuration — never hardcoded (CLAUDE.md > AI).
 *
 * Speech recognition (Whisper) runs entirely in the browser through a Web
 * Worker: no audio and no transcript ever leave the machine, not even to
 * Rearview's own server. `NEXT_PUBLIC_` is required because these are read in
 * client/worker code — they are public identifiers, not secrets.
 */

/** Whisper model repo. Default is multilingual and covers English + German. */
export const VOICE_MODEL =
  process.env.NEXT_PUBLIC_VOICE_MODEL?.trim() || "onnx-community/whisper-base";

/**
 * Execution device. "webgpu" is much faster where supported; the worker falls
 * back to "wasm" automatically if a device fails to initialise. Set to "wasm"
 * to force CPU.
 */
export const VOICE_DEVICE =
  process.env.NEXT_PUBLIC_VOICE_DEVICE?.trim() || "auto";

/** Sample rate the Whisper feature extractor expects (16 kHz mono). */
export const WHISPER_SAMPLE_RATE = 16_000;

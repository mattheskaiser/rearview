/**
 * Voice-to-text configuration — never hardcoded (CLAUDE.md > AI).
 *
 * Speech recognition runs entirely in the browser via whisper.cpp compiled to
 * WebAssembly, inside a Web Worker: no audio and no transcript ever leave the
 * machine, not even to Rearview's own server. `NEXT_PUBLIC_` is required
 * because these are read in client/worker code — they are public identifiers,
 * not secrets.
 */

/**
 * Quantized multilingual GGML model, fetched once and cached in IndexedDB.
 * Must NOT be an English-only ("*.en") model — English, German, and Spanish
 * all rely on the multilingual weights. Default is the quantized `base`
 * model; point this at `ggml-tiny-q5_1.bin` instead if `base` can't keep up
 * in real time on your hardware (see README > Voice input).
 */
export const VOICE_MODEL_URL =
  process.env.NEXT_PUBLIC_VOICE_MODEL_URL?.trim() ||
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin";

/** Approximate download size, only used for the one-time download prompt copy. */
export const VOICE_MODEL_SIZE_MB = Number(
  process.env.NEXT_PUBLIC_VOICE_MODEL_SIZE_MB?.trim() || "57",
);

/** Sample rate whisper.cpp's streaming loop expects (16 kHz mono). */
export const WHISPER_SAMPLE_RATE = 16_000;

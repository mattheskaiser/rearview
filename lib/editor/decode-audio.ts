import { WHISPER_SAMPLE_RATE } from "./voice-config";

/**
 * Decode a recorded audio blob into a mono `Float32Array` resampled to 16 kHz —
 * the exact shape the in-browser Whisper pipeline expects.
 *
 * An `OfflineAudioContext` at the target rate does the resampling and the
 * multi-channel down-mix in one render pass, so the result is deterministic
 * across browsers. Everything happens in the page; nothing is uploaded.
 */
export async function decodeToMono16kHz(blob: Blob): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer();

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) throw new Error("This browser has no Web Audio support.");

  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(bytes);
  } finally {
    void decodeCtx.close();
  }

  const frames = Math.max(
    1,
    Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE),
  );
  const offline = new OfflineAudioContext(1, frames, WHISPER_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

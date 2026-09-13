"use client";
import { decodeToMono16kHz } from "./decode-audio";
import type { WhisperSession } from "./whisper-session";

/**
 * Feeds microphone audio into a `WhisperSession` the same way whisper.cpp's
 * own `stream.wasm` reference does: record in back-to-back segments, decode
 * the growing blob for the current segment window, and push the raw PCM to
 * the (already-running, backgrounded) inference loop. Capture never waits on
 * transcription — it just keeps handing over fresher audio.
 */

/** Push cadence — lower than the reference's 5s for less first-text latency. */
const PUSH_EVERY_MS = 2000;
/** Restart the underlying recorder this often so a long dictation session
 *  doesn't force `decodeAudioData` to re-decode an ever-growing recording. */
const RESTART_AFTER_MS = 120_000;
/** whisper.cpp only ever reads the trailing 5s window; keep a small margin. */
const MAX_BUFFERED_SAMPLES = 10 * 16_000;

export function startCapture(stream: MediaStream, session: WhisperSession) {
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let buffered: Float32Array | null = null;
  let stopped = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const onSegment = async (blob: Blob) => {
    let decoded: Float32Array;
    try {
      decoded = await decodeToMono16kHz(blob);
    } catch {
      return; // a single bad segment shouldn't kill the recording
    }
    if (stopped) return;

    const start = buffered?.length ?? 0;
    const combined = new Float32Array(start + decoded.length);
    if (buffered) combined.set(buffered, 0);
    combined.set(decoded, start);

    buffered =
      combined.length > MAX_BUFFERED_SAMPLES
        ? combined.slice(combined.length - MAX_BUFFERED_SAMPLES)
        : combined;

    session.pushAudio(buffered);
  };

  const startRecorder = () => {
    chunks = [];
    const current = new MediaRecorder(stream);
    recorder = current;

    current.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
      if (chunks.length > 0) {
        void onSegment(new Blob(chunks, { type: current.mimeType }));
      }
    });

    current.start(PUSH_EVERY_MS);

    restartTimer = setTimeout(() => {
      if (stopped) return;
      current.addEventListener("stop", () => startRecorder(), { once: true });
      current.stop();
    }, RESTART_AFTER_MS);
  };

  startRecorder();

  return {
    stop() {
      stopped = true;
      if (restartTimer != null) clearTimeout(restartTimer);
      if (recorder?.state === "recording") recorder.stop();
    },
  };
}

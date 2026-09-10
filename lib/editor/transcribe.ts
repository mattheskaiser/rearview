"use client";
import { decodeToMono16kHz } from "./decode-audio";
import { VOICE_DEVICE, VOICE_MODEL } from "./voice-config";

/** Whisper language hint; `null` lets the model auto-detect (EN + DE covered). */
export type TranscribeLanguage = "english" | "german" | null;

let worker: Worker | null = null;
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Worker {
  worker ??= new Worker(
    new URL("./transcribe.worker.ts", import.meta.url),
    { type: "module" },
  );
  return worker;
}

function runOnWorker(audio: Float32Array, language: TranscribeLanguage) {
  const activeWorker = getWorker();
  return new Promise<string>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      cleanup();
      const data = event.data as
        | { ok: true; text: string }
        | { ok: false; error: string };
      if (data.ok) resolve(data.text);
      else reject(new Error(data.error));
    };
    const onError = () => {
      cleanup();
      reject(new Error("The transcription worker failed to start."));
    };
    const cleanup = () => {
      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);
    };
    activeWorker.addEventListener("message", onMessage);
    activeWorker.addEventListener("error", onError);
    activeWorker.postMessage(
      { audio, model: VOICE_MODEL, device: VOICE_DEVICE, language },
      [audio.buffer],
    );
  });
}

/**
 * Transcribe a recorded audio blob to text. Decoding happens on the main
 * thread; the model runs in a Web Worker so the UI never freezes. Calls are
 * serialised — ONNX Runtime processes one request at a time — so interim
 * previews and the final pass never overlap. Nothing is uploaded.
 */
export function transcribe(
  blob: Blob,
  language: TranscribeLanguage = null,
): Promise<string> {
  const run = queue
    .catch(() => undefined)
    .then(async () => {
      const audio = await decodeToMono16kHz(blob);
      return runOnWorker(audio, language);
    });
  queue = run;
  return run;
}

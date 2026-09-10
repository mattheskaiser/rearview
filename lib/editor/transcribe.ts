"use client";
import { decodeToMono16kHz } from "./decode-audio";
import { VOICE_MODEL } from "./voice-config";

/** Whisper language hint; `null` lets the model auto-detect (EN + DE covered). */
export type TranscribeLanguage = "english" | "german" | null;

let worker: Worker | null = null;

function getWorker(): Worker {
  worker ??= new Worker(
    new URL("./transcribe.worker.ts", import.meta.url),
    { type: "module" },
  );
  return worker;
}

/**
 * Transcribe a recorded audio blob to text. Decoding happens on the main
 * thread; the model runs in a Web Worker so the UI never freezes. Nothing is
 * uploaded — see `transcribe.worker.ts`.
 */
export async function transcribe(
  blob: Blob,
  language: TranscribeLanguage = null,
): Promise<string> {
  const audio = await decodeToMono16kHz(blob);
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
      { audio, model: VOICE_MODEL, language },
      [audio.buffer],
    );
  });
}

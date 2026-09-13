"use client";
import { loadModelBytes } from "./whisper-model-cache";
import { toWhisperLanguageCode, type TranscribeLanguage } from "./transcribe-language";
import { VOICE_MODEL_URL } from "./voice-config";

/**
 * Main-thread handle onto the whisper.cpp worker (`public/whisper/worker.js`).
 * Encapsulates the postMessage protocol so `useVoiceInput` only deals with
 * "push audio in, get text out" — it doesn't know whisper.cpp is the engine
 * (CLAUDE.md > Architecture). One session runs at a time.
 */

type WorkerOutMessage =
  | { type: "loaded" }
  | { type: "ready" }
  | { type: "text"; text: string }
  | { type: "stopped" }
  | { type: "error"; message: string };

let worker: Worker | null = null;
let modelLoadedInWorker = false;

function getWorker(): Worker {
  // A plain static file, not bundled — see the top-of-file comment in
  // `public/whisper/worker.js` for why it can't go through the app bundler.
  worker ??= new Worker("/whisper/worker.js");
  return worker;
}

/** `false` means the browser can't give whisper.cpp the SharedArrayBuffer it needs. */
export function isWhisperSupported(): boolean {
  return typeof SharedArrayBuffer !== "undefined" && crossOriginIsolated;
}

export type WhisperSession = {
  pushAudio: (audio: Float32Array) => void;
  /** Stop capture and wait briefly for any trailing transcription to drain. */
  stop: () => Promise<void>;
};

export async function createWhisperSession(options: {
  language: TranscribeLanguage;
  onText: (text: string) => void;
  onDownloadProgress?: (fraction: number) => void;
}): Promise<WhisperSession> {
  if (!isWhisperSupported()) {
    throw new Error(
      "This browser session isn't cross-origin isolated, so real-time voice input can't run.",
    );
  }

  const activeWorker = getWorker();

  await new Promise<void>((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerOutMessage>) => {
      const data = event.data;
      if (data.type === "loaded") {
        activeWorker.postMessage({
          type: "init",
          language: toWhisperLanguageCode(options.language),
        });
      } else if (data.type === "ready") {
        cleanup();
        resolve();
      } else if (data.type === "error") {
        cleanup();
        reject(new Error(data.message));
      }
    };
    const cleanup = () => activeWorker.removeEventListener("message", onMessage);
    activeWorker.addEventListener("message", onMessage);

    (async () => {
      if (modelLoadedInWorker) {
        activeWorker.postMessage({
          type: "init",
          language: toWhisperLanguageCode(options.language),
        });
        return;
      }
      const modelBytes = await loadModelBytes(
        VOICE_MODEL_URL,
        options.onDownloadProgress ?? (() => {}),
      );
      modelLoadedInWorker = true;
      activeWorker.postMessage({ type: "load", modelBytes }, [modelBytes]);
    })().catch((error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("Could not load the speech model."));
    });
  });

  const onTextMessage = (event: MessageEvent<WorkerOutMessage>) => {
    if (event.data.type === "text" && event.data.text) options.onText(event.data.text);
  };
  activeWorker.addEventListener("message", onTextMessage);

  return {
    pushAudio(audio) {
      // Not transferred: `useVoiceInput` keeps accumulating into the same
      // growing buffer between pushes (matches whisper.cpp's own reference
      // JS), so the caller must retain ownership of `audio.buffer`.
      activeWorker.postMessage({ type: "audio", audio });
    },
    stop() {
      return new Promise<void>((resolve) => {
        const onStopped = (event: MessageEvent<WorkerOutMessage>) => {
          if (event.data.type !== "stopped") return;
          activeWorker.removeEventListener("message", onStopped);
          activeWorker.removeEventListener("message", onTextMessage);
          resolve();
        };
        activeWorker.addEventListener("message", onStopped);
        activeWorker.postMessage({ type: "stop" });
      });
    },
  };
}

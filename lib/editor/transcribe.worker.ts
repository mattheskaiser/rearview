import { pipeline } from "@huggingface/transformers";

/**
 * Web Worker that runs Whisper speech-to-text entirely in the browser. It only
 * ever receives a decoded audio buffer and returns text — no network calls
 * carry journal content, and the model weights are the sole external fetch
 * (public files, cached by the browser after the first run).
 */

type TranscribeRequest = {
  audio: Float32Array;
  model: string;
  language: string | null;
};

type TranscribeResponse =
  | { ok: true; text: string }
  | { ok: false; error: string };

// Untyped worker scope so the file needs no "webworker" lib (which clashes with
// the project-wide "dom" lib).
const scope = self as unknown as {
  postMessage: (message: TranscribeResponse) => void;
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<TranscribeRequest>) => void,
  ) => void;
};

type Transcriber = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string } | { text: string }[]>;

let transcriberPromise: Promise<Transcriber> | null = null;
let loadedModel: string | null = null;

function getTranscriber(model: string): Promise<Transcriber> {
  if (!transcriberPromise || loadedModel !== model) {
    loadedModel = model;
    transcriberPromise = pipeline(
      "automatic-speech-recognition",
      model,
    ) as unknown as Promise<Transcriber>;
  }
  return transcriberPromise;
}

scope.addEventListener("message", async (event) => {
  const { audio, model, language } = event.data;
  try {
    const transcriber = await getTranscriber(model);
    const output = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      ...(language ? { language, task: "transcribe" } : {}),
    });
    const text = Array.isArray(output)
      ? output.map((part) => part.text).join(" ")
      : output.text;
    scope.postMessage({ ok: true, text: text.trim() });
  } catch (error) {
    scope.postMessage({
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not transcribe audio.",
    });
  }
});

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
  device: string;
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
let loadedKey: string | null = null;

/**
 * Load the ASR pipeline. `q4` weights hit an ONNX Runtime bug on WASM
 * ("Missing required scale … MatMulNBits"), so the decoder is forced to `q8`
 * (or `fp32` on WebGPU). WebGPU is tried first unless a device is pinned, then
 * we fall back to WASM.
 */
async function load(model: string, device: string): Promise<Transcriber> {
  const attempts: {
    device: "webgpu" | "wasm";
    dtype: Record<string, "fp32" | "q8">;
  }[] =
    device === "wasm"
      ? [{ device: "wasm", dtype: { encoder_model: "fp32", decoder_model_merged: "q8" } }]
      : device === "webgpu"
        ? [{ device: "webgpu", dtype: { encoder_model: "fp32", decoder_model_merged: "fp32" } }]
        : [
            { device: "webgpu", dtype: { encoder_model: "fp32", decoder_model_merged: "fp32" } },
            { device: "wasm", dtype: { encoder_model: "fp32", decoder_model_merged: "q8" } },
          ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return (await pipeline("automatic-speech-recognition", model, {
        device: attempt.device,
        dtype: attempt.dtype,
      })) as unknown as Transcriber;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not load the speech model.");
}

function getTranscriber(model: string, device: string): Promise<Transcriber> {
  const key = `${model}::${device}`;
  if (!transcriberPromise || loadedKey !== key) {
    loadedKey = key;
    transcriberPromise = load(model, device);
  }
  return transcriberPromise;
}

scope.addEventListener("message", async (event) => {
  const { audio, model, device, language } = event.data;
  try {
    const transcriber = await getTranscriber(model, device);
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

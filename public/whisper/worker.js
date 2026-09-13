/**
 * Runs whisper.cpp's official WebAssembly build (`stream.js`, vendored from
 * `ggml-org/whisper.cpp`'s `examples/stream.wasm`) inside a dedicated Web
 * Worker, so model loading and inference never touch the UI thread
 * (CLAUDE.md > Architecture). Nothing here ever sees journal content — only
 * raw microphone PCM and model bytes.
 *
 * Plain JS, served as a static file (not run through the app's bundler):
 * this must be a *classic* worker script because `stream.js` is a classic
 * Emscripten build that uses `importScripts` and expects a global `Module`,
 * and because it spawns its own pthread sub-workers by re-loading *this
 * worker's own URL* — an ES module worker can't do either of those.
 */

/** Poll cadence for drained text — decoupled from the 5 s inference window. */
const POLL_MS = 250;
/** How long to keep draining trailing text after `stop` before giving up. */
const STOP_DRAIN_MS = 2000;

let runtimeReady = false;
let pendingReady = [];
let instance = 0;
let pollTimer = null;

function whenReady() {
  if (runtimeReady) return Promise.resolve();
  return new Promise((resolve) => pendingReady.push(resolve));
}

self.Module = {
  onRuntimeInitialized: () => {
    runtimeReady = true;
    pendingReady.forEach((resolve) => resolve());
    pendingReady = [];
  },
};

importScripts("/whisper/stream.js");

function startPolling() {
  pollTimer = setInterval(() => {
    const text = Module.get_transcribed();
    if (text) postMessage({ type: "text", text });
  }, POLL_MS);
}

function stopPolling() {
  if (pollTimer != null) clearInterval(pollTimer);
  pollTimer = null;
}

self.addEventListener("message", async (event) => {
  const message = event.data;
  try {
    await whenReady();

    switch (message.type) {
      case "load": {
        Module.FS_createDataFile(
          "/",
          "whisper.bin",
          new Uint8Array(message.modelBytes),
          true,
          true,
        );
        postMessage({ type: "loaded" });
        break;
      }
      case "init": {
        instance = Module.init("whisper.bin", message.language);
        if (!instance) {
          postMessage({ type: "error", message: "Could not load the speech model." });
          break;
        }
        startPolling();
        postMessage({ type: "ready" });
        break;
      }
      case "audio": {
        if (instance) Module.set_audio(instance, message.audio);
        break;
      }
      case "stop": {
        if (instance) Module.free(instance);
        instance = 0;
        setTimeout(() => {
          stopPolling();
          postMessage({ type: "stopped" });
        }, STOP_DRAIN_MS);
        break;
      }
    }
  } catch (error) {
    postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Speech worker failed.",
    });
  }
});

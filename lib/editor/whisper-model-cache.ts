"use client";

/**
 * Fetches the whisper.cpp GGML model once and caches the raw bytes in
 * IndexedDB, keyed by URL — mirrors the caching strategy in whisper.cpp's own
 * `examples/stream.wasm` reference (`loadRemote` in its `helpers.js`), so
 * repeat visits skip the network entirely and the app keeps transcribing with
 * the network disconnected. Nothing here is journal content — only the model
 * weights are fetched (CLAUDE.md > Privacy).
 */

const DB_NAME = "rearview-whisper";
const DB_VERSION = 1;
const STORE = "models";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCached(db: IDBDatabase, url: string): Promise<ArrayBuffer | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(url);
    request.onsuccess = () => resolve(request.result as ArrayBuffer | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeCached(db: IDBDatabase, url: string, data: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(data, url);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function fetchWithProgress(
  url: string,
  onProgress: (fraction: number) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Could not download the speech model (${response.status}).`);
  }

  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total > 0) onProgress(received / total);
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer.buffer;
}

/**
 * Resolve the model bytes for `url`, using the IndexedDB cache when present.
 * `onProgress` (0–1) only fires while actually downloading.
 */
export async function loadModelBytes(
  url: string,
  onProgress: (fraction: number) => void,
): Promise<ArrayBuffer> {
  const db = await openDb();

  const cached = await readCached(db, url);
  if (cached) return cached;

  const data = await fetchWithProgress(url, onProgress);
  await writeCached(db, url, data);
  return data;
}

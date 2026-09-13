This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Spell check

The journal editor has its own spell checker (English + German, fully offline —
no text ever leaves the machine). It uses `nspell` with the Hunspell
dictionaries, vendored into `public/dictionaries/` by
`scripts/sync-dictionaries.mjs` (runs on `npm install`).

- Unknown words get a red wavy underline **while the editor is focused** — they
  disappear when you click away.
- Click a flagged word for a small menu: pick a suggestion to replace it,
  **Ignore once** (this browser session), or **Add to dictionary** (remembered
  in `localStorage` on this device).
- German noun compounds (`Bahnhof`, `Wochenende`, …) are accepted via a
  split-into-known-parts heuristic, since the flat word list doesn't contain
  them all.

## Voice input

The editor has a mic button for real-time dictation, powered by
[whisper.cpp](https://github.com/ggml-org/whisper.cpp) compiled to
WebAssembly — the same official browser build as its `examples/stream.wasm`
demo (vendored at `public/whisper/stream.js`), run inside a Web Worker so
inference never touches the UI thread. No audio or transcript is sent to any
server, not even Rearview's own.

Architecturally this is *not* "record a clip, then transcribe it": whisper.cpp
loads the model once and runs a persistent background thread (a real OS thread,
via WebAssembly threads + `SharedArrayBuffer`) that continuously transcribes a
5-second rolling window of audio, decoupled from audio capture. The app just
keeps handing over fresh microphone PCM every couple of seconds; because
inference is bounded and never blocks on capture, it can't progressively fall
behind during long, continuous speech the way a "batch re-transcribe" approach
would. `onTranscript` fires with each new chunk of recognised text as it's
produced.

- The first use downloads the model (public file, cached in **IndexedDB**, not
  just the HTTP cache) — after that it works fully offline. Set
  `NEXT_PUBLIC_VOICE_MODEL_URL` to change it; it must be a *multilingual*
  quantized GGML model (not a `*.en`-suffixed one). The default,
  `ggml-base-q5_1.bin` (~57 MB), covers English, German, and Spanish. If it's
  too slow for real time on your hardware, point this at
  `ggml-tiny-q5_1.bin` (~30 MB) instead — smaller and faster, less accurate.
- Requires the app to be served **cross-origin isolated** (`next.config.ts`
  sets `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: credentialless`) so the browser allows
  `SharedArrayBuffer`. This applies to the whole app, not just the editor.
- While recording, the mic control shows a live input-level meter and a timer.
- whisper.cpp is MIT-licensed; the vendored build is its own official compiled
  output, unmodified.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

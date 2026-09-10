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

The journal editor uses the browser's built-in spell checker (fully offline —
no text ever leaves the machine). Misspelled words get a red underline as you
type; right-click a word for suggestions, or choose **Add to dictionary** to
stop it being flagged (persists per browser profile).

For English + German, enable both languages for spell check in the browser:

- **Chrome/Edge:** Settings → Languages → add *English* and *Deutsch*, then tick
  "Use this language to check spelling" for each.
- **Firefox:** right-click the editor → Languages → add the dictionaries, then
  enable "Check Spelling".

## Voice input

The editor has a mic button that transcribes speech to text. Whisper runs
**entirely in the browser** in a Web Worker — no audio or transcript is sent to
any server, not even Rearview's own. The first use downloads the model weights
(public files, ~40–150 MB depending on the model) from the Hugging Face CDN and
the browser caches them; every use after that is fully offline. WebGPU is used
when the browser supports it, otherwise WASM (slower).

- English and German are both covered by the default `whisper-base` model.
- Set `NEXT_PUBLIC_VOICE_MODEL` to change the model (e.g.
  `onnx-community/whisper-small` for better accuracy at a larger download).
- For zero external traffic even on first run, vendor the model files under
  `public/models/…` and point `NEXT_PUBLIC_VOICE_MODEL` at that local path.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

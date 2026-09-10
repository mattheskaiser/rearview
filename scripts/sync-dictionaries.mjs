// Copies the Hunspell dictionary data for the in-app spell checker into
// `public/dictionaries/` so the browser can fetch it from the app's own origin.
// The npm packages read these files via `node:fs`, which does not work in the
// browser — the raw `.aff` / `.dic` payloads do. Run from `postinstall`.
import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "public/dictionaries");

const files = [
  ["dictionary-en/index.aff", "en.aff"],
  ["dictionary-en/index.dic", "en.dic"],
  ["dictionary-de/index.aff", "de.aff"],
  ["dictionary-de/index.dic", "de.dic"],
];

await mkdir(out, { recursive: true });
for (const [from, to] of files) {
  await copyFile(resolve(root, "node_modules", from), resolve(out, to));
}
console.log(`synced ${files.length} dictionary files to public/dictionaries/`);

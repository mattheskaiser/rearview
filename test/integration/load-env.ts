import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Minimal `.env` loader for the integration suite. Unit tests mock `@/lib/env`
 * and never need this; the integration tests import the real services, which
 * parse `lib/env.ts` against `process.env`, so the local `.env` has to be
 * present. Kept dependency-free on purpose.
 *
 * Only fills keys that are not already set, so CI / shell overrides still win.
 */
export function loadEnv(): void {
  const path = fileURLToPath(new URL("../../.env", import.meta.url));

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return; // no .env — the env schema will report what is missing
  }

  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const value = rawValue.replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}

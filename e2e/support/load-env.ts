import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal `.env.test` loader for the E2E harness. Runs before any module that
 * reads `lib/env.ts` is imported (Playwright config, global setup, seed
 * scripts). Only fills keys that are not already set, so a shell / CI override
 * still wins. Dependency-free on purpose.
 *
 * Resolved from the current working directory — Playwright always runs from the
 * repo root, where `.env.test` lives.
 */
export function loadTestEnv(): void {
  const path = resolve(process.cwd(), ".env.test");

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      ".env.test not found at repo root. See docs/testing/test-db-setup.md for one-time setup.",
    );
  }

  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

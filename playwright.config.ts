import { defineConfig, devices } from "@playwright/test";

import { loadTestEnv } from "./e2e/support/load-env";

/**
 * E2E suite for Rearview (docs/testing/retrieval-e2e-plan.md).
 *
 * Runs the built app against an isolated test database (.env.test) and the
 * local Ollama. `global-setup` migrates the DB, registers the single account,
 * seeds the 60-entry corpus and waits for every chunk to embed; retrieval specs
 * then read that shared corpus.
 *
 * Two projects:
 *  - `chromium`     — the app with a working Ollama (auth, authoring, activity
 *                     map, retrieval, memories).
 *  - `ollama-down`  — a second app instance whose OLLAMA_BASE_URL points at a
 *                     dead port, to prove the journal keeps working when
 *                     inference is unavailable.
 */

loadTestEnv();

const PORT = 3100;
const OLLAMA_DOWN_PORT = 3101;
const baseURL = `http://localhost:${PORT}`;
const ollamaDownURL = `http://localhost:${OLLAMA_DOWN_PORT}`;

export default defineConfig({
  testDir: "./e2e/specs",
  tsconfig: "./e2e/tsconfig.json",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Generation on a loaded local machine (Ollama swapping bge-m3 / llama3.1) is
  // slow and occasionally stalls; one retry salvages the flaky ones.
  retries: process.env.CI ? 2 : 1,
  timeout: 420_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "e2e/artifacts/html-report" }],
  ],
  outputDir: "./e2e/artifacts/test-results",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    storageState: "./e2e/artifacts/storage-state.json",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /ollama-down\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL },
    },
    {
      name: "ollama-down",
      testMatch: /ollama-down\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: ollamaDownURL },
    },
  ],
  webServer: [
    {
      command: `npm run build && npm run start -- -p ${PORT}`,
      url: `${baseURL}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      stdout: "pipe",
      env: { ...process.env, BETTER_AUTH_URL: baseURL },
    },
    {
      command: `node e2e/support/wait-for.mjs ${baseURL}/login && npm run start -- -p ${OLLAMA_DOWN_PORT}`,
      url: `${ollamaDownURL}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      stdout: "pipe",
      env: {
        ...process.env,
        BETTER_AUTH_URL: ollamaDownURL,
        OLLAMA_BASE_URL: "http://127.0.0.1:1",
      },
    },
  ],
});

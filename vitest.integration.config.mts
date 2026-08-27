import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Integration suite. Unlike the unit tests (which mock Ollama and Postgres),
 * these hit a real local Ollama through the real embedding service to verify
 * that multilingual and cross-language retrieval actually work.
 *
 * Run explicitly: `npm run test:integration`. Requires Ollama running locally
 * with the configured EMBEDDING_MODEL pulled; the suite skips itself otherwise.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./test/server-only-shim.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["./test/integration/setup.ts"],
    // Embedding a whole corpus over HTTP is slower than a unit test.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});

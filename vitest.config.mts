import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests target the pure `lib/**` logic (node environment). Component
 * tests would opt into jsdom per-file; none exist yet.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // The real `server-only` module throws on import outside an RSC bundle.
      "server-only": fileURLToPath(
        new URL("./test/server-only-shim.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts", "lib/db/**", "lib/env.ts"],
    },
  },
});

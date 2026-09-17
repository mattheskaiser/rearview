import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    // Next.js logs Server Function calls with their raw arguments in dev by
    // default (docs/01-app/03-api-reference/05-config/01-next-config-js/logging.md).
    // Auth actions take { email, password } directly, so leaving this on
    // prints plaintext passwords to the terminal on every sign-in.
    serverFunctions: false
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/overview",
        permanent: false
      }
    ]
  },
  async headers() {
    return [
      {
        // Cross-origin isolation, required for the SharedArrayBuffer that
        // whisper.cpp's WASM build uses for multi-threaded inference.
        // "credentialless" (not "require-corp") because the model download
        // from Hugging Face's CDN doesn't send a Cross-Origin-Resource-Policy
        // header, which "require-corp" would otherwise need to allow it.
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" }
        ]
      },
      {
        // The vendored whisper.cpp WASM build changes only when we deploy a
        // new copy of it. If it's ever updated, rename the file so this
        // long-lived cache doesn't serve the stale build to returning users.
        source: "/whisper/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      }
    ]
  }
};

export default nextConfig;

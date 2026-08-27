// Playwright stand-in for the `server-only` marker package.
//
// In the app, importing `server-only` from a Client Component is a build error.
// Under Playwright (plain Node, no `react-server` export condition) the real
// module throws on import, so `e2e/tsconfig.json` aliases `server-only` here to
// let the E2E harness import the production `lib/**` services directly — the
// same trick `vitest.integration.config.mts` uses.
export {};

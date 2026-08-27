// Vitest stand-in for the `server-only` package. In the app, importing
// `server-only` from a Client Component is a build error; under Vitest (plain
// Node, no `react-server` condition) the real module throws on import, so we
// alias it to this no-op to exercise server modules directly.
export {};

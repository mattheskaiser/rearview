// Poll a URL until it responds (any HTTP status), then exit 0. Used to gate the
// second (ollama-down) web server on the first server's `next build` finishing,
// so the build runs exactly once and both servers share one `.next`.
const url = process.argv[2];
const timeoutMs = Number(process.argv[3] ?? 170_000);
const deadline = Date.now() + timeoutMs;

if (!url) {
  console.error("wait-for.mjs: missing URL argument");
  process.exit(1);
}

while (Date.now() < deadline) {
  try {
    await fetch(url, { redirect: "manual" });
    process.exit(0);
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

console.error(`wait-for.mjs: ${url} did not respond within ${timeoutMs}ms`);
process.exit(1);

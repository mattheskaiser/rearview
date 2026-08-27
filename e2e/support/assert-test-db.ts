/**
 * Hard guard: the seed and reset scripts destroy and rewrite data, so they must
 * only ever touch a throwaway database. This aborts unless the connection URL's
 * host is loopback or the host / database name contains "test".
 *
 * The dev Neon branch (`ep-*.aws.neon.tech/neondb`) matches none of these, so a
 * misconfigured `.env.test` — or an accidental run with the dev `.env` loaded —
 * fails loudly instead of mutating the real journal.
 */

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function assertTestDatabase(url: string | undefined = process.env.DATABASE_URL): void {
  if (!url) {
    throw new Error("DATABASE_URL is not set — refusing to run seed/reset.");
  }

  let host: string;
  let database: string;
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    database = parsed.pathname.replace(/^\//, "");
  } catch {
    throw new Error("DATABASE_URL is not a valid URL — refusing to run seed/reset.");
  }

  const allowed =
    LOOPBACK.has(host) || /test/i.test(host) || /test/i.test(database);

  if (!allowed) {
    throw new Error(
      `Refusing to run seed/reset against "${host}/${database}". ` +
        `The E2E test database host must be loopback or its host/name must contain "test". ` +
        `Check .env.test (docs/testing/test-db-setup.md).`,
    );
  }
}

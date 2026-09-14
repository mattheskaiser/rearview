import { afterEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

import { AUTH_LOGGER_OPTIONS } from "@/lib/auth/logger-options";

/**
 * Regression test for the credential-logging incident (an email/password were
 * once seen printed in the terminal during sign-in). `lib/auth.ts` itself
 * wires a real Prisma/Postgres adapter and can't run without a database, so
 * this builds a throwaway Better Auth instance on the in-memory adapter
 * instead, configured with the same `AUTH_LOGGER_OPTIONS` the real instance
 * uses (imported, not copied, so the two can't drift) — the leak vector under
 * test is Better Auth's own internal logger, not the Postgres adapter, so
 * this is a faithful check of the setting actually shipped in lib/auth.ts.
 */

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

function spyOnConsole() {
  return CONSOLE_METHODS.map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}),
  );
}

function allLoggedText(spies: ReturnType<typeof spyOnConsole>): string {
  return spies
    .flatMap((spy) => spy.mock.calls)
    .flat()
    .map((value) => String(value))
    .join("\n");
}

function createTestAuth() {
  return betterAuth({
    secret: "test-secret-at-least-32-characters-long",
    baseURL: "http://localhost:3000",
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true },
    logger: AUTH_LOGGER_OPTIONS,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auth credential logging", () => {
  it("never logs the attempted email or password on a failed sign-in", async () => {
    const auth = createTestAuth();
    const CANARY_EMAIL = "zzz-canary-9f3a@example.com";
    const CANARY_PASSWORD = "zzz-canary-password-9f3a-do-not-log";

    const spies = spyOnConsole();
    await auth.api
      .signInEmail({ body: { email: CANARY_EMAIL, password: CANARY_PASSWORD } })
      .catch(() => {});
    const logged = allLoggedText(spies);

    expect(logged).not.toContain(CANARY_EMAIL);
    expect(logged).not.toContain(CANARY_PASSWORD);
  });

  it("never logs the real password on a successful sign-up + sign-in", async () => {
    const auth = createTestAuth();
    const REAL_PASSWORD = "correct-horse-battery-staple-9f3a";
    await auth.api.signUpEmail({
      body: { email: "real-user@example.com", name: "Real User", password: REAL_PASSWORD },
    });

    const spies = spyOnConsole();
    await auth.api.signInEmail({
      body: { email: "real-user@example.com", password: REAL_PASSWORD },
    });
    const logged = allLoggedText(spies);

    expect(logged).not.toContain(REAL_PASSWORD);
  });

  it("suppresses Better Auth's own diagnostic logging (e.g. \"User not found\")", async () => {
    const auth = createTestAuth();

    const spies = spyOnConsole();
    await auth.api
      .signInEmail({ body: { email: "nobody@example.com", password: "wrong-password" } })
      .catch(() => {});

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

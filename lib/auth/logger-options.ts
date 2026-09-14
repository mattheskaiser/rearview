/**
 * Better Auth's default "warn" level prints diagnostic lines like "User not
 * found" straight to the terminal on every failed sign-in attempt — never
 * credentials themselves (verified by reading every emailAndPassword log call
 * site), but still account-enumeration signal with no app-level control.
 * Capped at "error" so routine auth traffic stays quiet.
 *
 * Deliberately its own dependency-free module (no `server-only`, no `env`, no
 * Prisma): `lib/auth.ts` uses it to configure the real instance, and
 * `lib/auth.test.ts` imports the same constant to drive Better Auth's
 * in-memory test harness, so the test can't silently drift from what
 * production actually ships.
 *
 * Do not raise this without re-auditing every logger call site for
 * interpolated request data first.
 */
export const AUTH_LOGGER_OPTIONS = { level: "error" } as const;

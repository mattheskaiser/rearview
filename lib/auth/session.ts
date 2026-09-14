import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

/**
 * Data Access Layer for authentication (Next.js auth guide > Creating a DAL).
 *
 * Every private page and server action calls one of these. `proxy.ts` only does
 * an optimistic cookie redirect; the real check happens here, against the
 * session record, close to the data.
 */

export type CurrentSession = {
  userId: string;
  name: string;
  email: string;
};

/**
 * Force re-auth after this long with no request touching the session.
 * Independent of Better Auth's own `session.expiresIn`/`updateAge` (the
 * absolute cap in lib/auth.ts) — this is the day-to-day control.
 *
 * Precision is a few minutes either side of the nominal value, not exact:
 * it's bounded by TOUCH_THROTTLE_MS below and by Better Auth's own
 * `cookieCache` TTL, not measured to the second.
 */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** Only write the "last active" touch this often, not on every request. */
const TOUCH_THROTTLE_MS = 2 * 60 * 1000;

export type IdleAction = "revoke" | "touch" | "ok";

/**
 * Pure decision for how long a session has sat idle (extracted so the
 * security-relevant branching is unit-testable without mocking `next/headers`
 * or a live Better Auth/Prisma instance).
 */
export function decideIdleAction(idleForMs: number): IdleAction {
  if (idleForMs > IDLE_TIMEOUT_MS) return "revoke";
  if (idleForMs > TOUCH_THROTTLE_MS) return "touch";
  return "ok";
}

/**
 * The verified session for this request, or null. Memoised per render pass so
 * repeated calls in a page + its components hit Better Auth once.
 *
 * Also enforces the idle timeout: `Session.updatedAt` (bumped by the throttled
 * touch below) stands in for "last activity". A session idle past
 * {@link IDLE_TIMEOUT_MS} is revoked here rather than left for its 12-hour
 * absolute expiry to catch.
 */
export const getCurrentSession = cache(
  async (): Promise<CurrentSession | null> => {
    try {
      const result = await auth.api.getSession({ headers: await headers() });
      if (!result?.user || !result.session) return null;

      const idleForMs = Date.now() - result.session.updatedAt.getTime();
      switch (decideIdleAction(idleForMs)) {
        case "revoke":
          await auth.api.revokeSession({
            headers: await headers(),
            body: { token: result.session.token },
          });
          return null;
        case "touch":
          // Fire-and-forget: refreshing the idle clock must never block or
          // fail the request that triggered it.
          void prisma.session
            .update({
              where: { id: result.session.id },
              data: { updatedAt: new Date() },
            })
            .catch(() => {});
          break;
        case "ok":
          break;
      }

      return {
        userId: result.user.id,
        name: result.user.name,
        email: result.user.email,
      };
    } catch {
      // Auth store unreachable — treat as unauthenticated rather than 500.
      return null;
    }
  },
);

/**
 * Require an authenticated session. Redirects to /login when there is none, so
 * callers can treat the return value as always present.
 */
export async function requireSession(): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

/** Require an authenticated user, returning just the id. */
export async function requireUserId(): Promise<string> {
  return (await requireSession()).userId;
}

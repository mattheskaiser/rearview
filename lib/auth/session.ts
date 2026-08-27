import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

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
 * The verified session for this request, or null. Memoised per render pass so
 * repeated calls in a page + its components hit Better Auth once.
 */
export const getCurrentSession = cache(
  async (): Promise<CurrentSession | null> => {
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session?.user) return null;
      return {
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email,
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

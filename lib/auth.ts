import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { claimOwnerlessRecords } from "@/lib/auth/bootstrap";
import {
  canRegister,
  REGISTRATION_CLOSED_MESSAGE,
} from "@/lib/auth/registration";
import { prisma } from "@/lib/db/client";
import { env } from "@/lib/env";

/**
 * Better Auth server instance (CLAUDE.md > Architecture: AI/DB/auth concerns
 * separated; session prompt: mature library, no hand-rolled crypto).
 *
 * - Email + password only. Hashing (scrypt), sessions and CSRF are the
 *   library's; Rearview never implements cryptography itself.
 * - Sessions are stored in Postgres via the Prisma adapter and referenced by a
 *   signed, HttpOnly cookie. `BETTER_AUTH_SECRET` never reaches the browser.
 * - Sign-up self-locks after the first account (see `canRegister`). The safe
 *   state is the default state, so a deployment can't expose open registration.
 */
export const auth = betterAuth({
  appName: "Rearview",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [env.BETTER_AUTH_URL],

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  session: {
    // 30-day rolling session, refreshed at most once a day.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  advanced: {
    cookiePrefix: "rearview",
    // Secure cookies whenever the app is served over https.
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
  },

  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const userCount = await prisma.user.count();
          if (
            !canRegister({
              userCount,
              allowRegistration: env.AUTH_ALLOW_REGISTRATION,
            })
          ) {
            throw new APIError("FORBIDDEN", {
              message: REGISTRATION_CLOSED_MESSAGE,
            });
          }
        },
        after: async (user) => {
          // First account only: adopt every pre-auth ownerless record.
          const userCount = await prisma.user.count();
          if (userCount === 1) await claimOwnerlessRecords(user.id);
        },
      },
    },
  },

  // `nextCookies` must be the last plugin: it flushes Better Auth's Set-Cookie
  // headers from server actions into the Next.js cookie store.
  plugins: [nextCookies()],
});

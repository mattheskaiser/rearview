import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

/**
 * Better Auth HTTP endpoints (sign-in, sign-up, sign-out, session, ...).
 * This is the only public API surface; every other route is gated by `proxy.ts`
 * and the per-request DAL check.
 */
export const { GET, POST } = toNextJsHandler(auth);

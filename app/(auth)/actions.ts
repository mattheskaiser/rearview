"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

/**
 * Server actions for the auth screens (Next.js auth guide > Server Actions run
 * on the server, a secure place for auth logic). Validation is re-run here; the
 * `nextCookies()` plugin flushes Better Auth's Set-Cookie into the response.
 * Errors are mapped to short, non-leaky messages — never the raw exception.
 */

export type AuthActionResult = { ok: false; error: string };

const SIGN_IN_FAILED = "That email and password don't match.";
const SIGN_UP_FAILED = "Could not create your account. Please try again.";
const GENERIC = "Something went wrong. Please try again.";

function messageFrom(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "body" in error &&
    error.body &&
    typeof error.body === "object" &&
    "message" in error.body &&
    typeof error.body.message === "string"
  ) {
    return error.body.message;
  }
  return fallback;
}

export async function signInAction(
  input: unknown,
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch {
    // Deliberately generic: don't reveal whether the email exists.
    return { ok: false, error: SIGN_IN_FAILED };
  }

  redirect("/overview");
}

export async function signUpAction(
  input: unknown,
): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
  } catch (error) {
    // Registration is locked and duplicate-email is not sensitive on this
    // screen, so Better Auth's own message is safe to show here.
    return { ok: false, error: messageFrom(error, SIGN_UP_FAILED) };
  }

  redirect("/overview");
}

export async function signOutAction(): Promise<void> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Even if the server call fails, fall through to the login screen.
  }
  redirect("/login");
}

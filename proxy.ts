import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic auth gate (Next.js auth guide > Optimistic checks with Proxy).
 *
 * This only looks at whether a session cookie is present — no database call,
 * no verification. It exists to bounce anonymous traffic to /login early and
 * keep authenticated users off the auth screens. The real check is the
 * per-request `requireSession()` in every (app) page and server action.
 */

const PUBLIC_PATHS = ["/login", "/register"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const hasSessionCookie =
    getSessionCookie(request, { cookiePrefix: "rearview" }) != null;

  if (!hasSessionCookie && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSessionCookie && isPublic) {
    return NextResponse.redirect(new URL("/overview", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except the Better Auth endpoints and static assets
  // (anything with a file extension, plus the Next.js internals).
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};

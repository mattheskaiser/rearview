import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rearview",
  description: "Review what's in the rearview.",
};

// Sets `<html class="dark">` (or not) before hydration, so the page never
// flashes the wrong theme. Mirrors `useTheme`'s stored-choice-else-system
// logic: an explicit choice (localStorage) wins, otherwise the OS preference
// decides. `beforeInteractive` guarantees this runs before any paint.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("rearview-theme");
    var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

// The app shell (sidebar) lives in app/(app)/layout.tsx so it never wraps the
// auth screens. Every route is gated by proxy.ts + a per-request session check.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} h-full antialiased`}
      // The theme-init script below adds/removes "dark" on this element before
      // React hydrates, so the live DOM's class attribute legitimately differs
      // from what was server-rendered. That's the one attribute this should
      // suppress the mismatch warning for — everything else still hydrates
      // normally (suppressHydrationWarning does not apply to descendants).
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}

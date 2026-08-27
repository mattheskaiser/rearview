import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getCurrentSession } from "@/lib/auth/session";

/**
 * Layout for the auth screens (login / register). No sidebar. An already
 * authenticated visitor is sent straight into the app — proxy.ts does this
 * optimistically, this is the server-side confirmation.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (session) redirect("/overview");

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

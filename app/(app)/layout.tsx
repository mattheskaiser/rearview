import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Sidebar } from "@/app/components/organisms/Sidebar.organism";
import { getCurrentSession } from "@/lib/auth/session";

const navItems = [
  { label: "Overview", href: "/overview" },
  { label: "Entries", href: "/entries" },
  { label: "Memories", href: "/memories" },
];

/**
 * Shell for every authenticated route. proxy.ts already redirects anonymous
 * requests; this layout is a second gate and provides the session identity the
 * sidebar shows. Each page additionally re-checks (layouts don't re-run on
 * client navigation — Next.js auth guide).
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-row">
      <Sidebar items={navItems} accountEmail={session.email} />
      <main className="flex-1">{children}</main>
    </div>
  );
}

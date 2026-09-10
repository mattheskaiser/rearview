import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Sidebar } from "@/app/components/organisms/Sidebar.organism";
import { getCurrentSession } from "@/lib/auth/session";
import { Toaster } from "@/components/ui/toast";

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
    <div className="flex h-screen flex-row overflow-hidden">
      <Sidebar items={navItems} accountEmail={session.email} />
      {/* Only the page content scrolls; the sidebar stays put. */}
      <main className="h-full flex-1 overflow-y-auto">{children}</main>
      <Toaster />
    </div>
  );
}

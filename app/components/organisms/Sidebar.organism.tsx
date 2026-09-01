"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/app/components/molecules/LogoutButton.molecule";
import { ThemeToggle } from "@/app/components/molecules/ThemeToggle.molecule";
import { cn } from "@/lib/utils";

type SidebarItem = { label: string; href: string };

type SidebarProps = {
  items: SidebarItem[];
  /** Signed-in account, shown above the sign-out control. */
  accountEmail?: string;
};

export const Sidebar = ({ items, accountEmail }: SidebarProps) => {
  const pathname = usePathname();

  return (
    <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-border p-3">
      <span className="px-2 py-1 text-sm font-semibold tracking-wide">
        Rearview
      </span>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-2 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-secondary/60",
            )}
          >
            {item.label}
          </Link>
        );
      })}

      <div className="mt-auto flex flex-col gap-2 pt-3">
        <div className="flex items-center justify-between gap-2 px-2">
          {accountEmail ? (
            <span className="truncate text-xs text-muted-foreground">
              {accountEmail}
            </span>
          ) : (
            <span />
          )}
          <ThemeToggle />
        </div>
        <LogoutButton />
      </div>
    </nav>
  );
};

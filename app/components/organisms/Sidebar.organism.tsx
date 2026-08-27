"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type SidebarItem = { label: string; href: string };

export const Sidebar = ({ items }: { items: SidebarItem[] }) => {
  const pathname = usePathname();

  return (
    <nav className="w-48 shrink-0 border-r border-border flex flex-col gap-1 p-3">
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
    </nav>
  );
};

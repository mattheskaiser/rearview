"use client";
import { cn } from "@/lib/utils";

export type TabItem<T extends string> = { id: T; label: string };

type TabNavProps<T extends string> = {
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Accessible name for the tab list. */
  ariaLabel?: string;
};

/**
 * Simple underlined tab switcher. Both panels stay mounted by the caller — this
 * only toggles which one is visible — so nothing in either tab loses state on a
 * switch.
 */
export function TabNav<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
}: TabNavProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 border-b border-border"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors",
            active === tab.id
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

"use client";
import { cn } from "@/lib/utils";

type YearNavProps = {
  years: number[];
  selected: number;
  onSelect: (year: number) => void;
};

/**
 * Vertical year picker beside the activity calendar. The list is data-driven —
 * whatever years {@link listActivityYears} produced — newest first.
 */
export const YearNav = ({ years, selected, onSelect }: YearNavProps) => {
  return (
    <nav
      aria-label="Activity year"
      className="flex shrink-0 flex-col gap-1 sm:w-20"
    >
      {[...years].reverse().map((year) => (
        <button
          key={year}
          type="button"
          aria-current={year === selected ? "true" : undefined}
          onClick={() => onSelect(year)}
          className={cn(
            "cursor-pointer rounded-md px-2 py-1 text-left text-sm transition-colors",
            year === selected
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-secondary/60",
          )}
        >
          {year}
        </button>
      ))}
    </nav>
  );
};

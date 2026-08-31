"use client";
import { cn } from "@/lib/utils";

type YearNavProps = {
  years: number[];
  selected: number;
  onSelect: (year: number) => void;
  /** Accessible name; defaults to the activity-map wording. */
  ariaLabel?: string;
};

/**
 * Vertical year picker. The list is data-driven — whatever years the caller
 * passes — rendered newest first. Used by the activity calendar.
 */
export const YearNav = ({
  years,
  selected,
  onSelect,
  ariaLabel = "Activity year",
}: YearNavProps) => {
  return (
    <nav
      aria-label={ariaLabel}
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

"use client";
import { monthName } from "@/lib/time/journal-months";
import { cn } from "@/lib/utils";

type MonthFilterProps = {
  /** 1-based months that have entries this year, ascending. */
  months: number[];
  /** Selected month (1-based), or null for "All". */
  selected: number | null;
  onSelect: (month: number | null) => void;
};

/**
 * Filter pills for a journal year: "All" plus one pill per month that actually
 * has entries. Selection is client-side only — it never navigates.
 */
export const MonthFilter = ({ months, selected, onSelect }: MonthFilterProps) => {
  return (
    <div
      role="group"
      aria-label="Filter entries by month"
      className="flex flex-wrap gap-2"
    >
      <Pill active={selected === null} onClick={() => onSelect(null)}>
        All
      </Pill>
      {months.map((month) => (
        <Pill
          key={month}
          active={selected === month}
          onClick={() => onSelect(month)}
        >
          {monthName(month)}
        </Pill>
      ))}
    </div>
  );
};

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

"use client";
import { useMemo, useState } from "react";

import { EmptyState } from "@/app/components/atoms/EmptyState.atom";
import { ActivityLegend } from "@/app/components/molecules/ActivityLegend.molecule";
import { YearCalendar } from "@/app/components/molecules/YearCalendar.molecule";
import { YearNav } from "@/app/components/molecules/YearNav.molecule";
import { buildYearGrid, listActivityYears } from "@/lib/time/activity-grid";

type ActivityMapProps = {
  /** Dates with journal entries, as `YYYY-MM-DD`. */
  entryDates: string[];
  /** Today's calendar day in the host timezone, `YYYY-MM-DD`. */
  today: string;
};

/**
 * Yearly journal activity. The list of years and every date range come from the
 * data — earliest entry through latest entry (CLAUDE.md > Overview). Selecting a
 * year immediately swaps in that year's calendar.
 */
export const ActivityMap = ({ entryDates, today }: ActivityMapProps) => {
  const years = useMemo(() => listActivityYears(entryDates), [entryDates]);
  const [year, setYear] = useState<number | null>(null);

  const selectedYear = year != null && years.includes(year)
    ? year
    : years[years.length - 1];

  const grid = useMemo(
    () =>
      selectedYear != null
        ? buildYearGrid(selectedYear, entryDates, today)
        : null,
    [selectedYear, entryDates, today],
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
          Journal activity
        </h2>
        <ActivityLegend />
      </div>

      {grid && selectedYear != null ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <YearCalendar grid={grid} />
          <YearNav years={years} selected={selectedYear} onSelect={setYear} />
        </div>
      ) : (
        <EmptyState
          title="No journal activity yet"
          description="Write your first entry and it will show up here."
        />
      )}
    </section>
  );
};

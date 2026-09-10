"use client";
import { useEffect, useRef } from "react";

import { ActivityCell } from "@/app/components/molecules/ActivityCell.molecule";
import type { YearGrid } from "@/lib/time/activity-grid";

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

/**
 * One year's GitHub-style contribution calendar: month labels across the top,
 * weekday hints down the left, one column per week (Sunday first). The scroll
 * area opens fully scrolled right, so the newest weeks are visible first — for a
 * past year that's December, for the current year that's today at the edge.
 */
export const YearCalendar = ({ grid }: { grid: YearGrid }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const labelByColumn = new Map(
    grid.monthLabels.map((m) => [m.column, m.label]),
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [grid]);

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1">
        <div className="flex gap-1 pl-8 text-[10px] text-muted-foreground">
          {grid.weeks.map((_, column) => (
            <span key={column} className="w-3">
              {labelByColumn.get(column) ?? ""}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <div className="flex w-7 flex-col gap-1 text-[10px] text-muted-foreground">
            {DAY_LABELS.map((label, row) => (
              <span key={row} className="flex h-3 items-center">
                {label}
              </span>
            ))}
          </div>
          {grid.weeks.map((week, column) => (
            <div key={column} className="flex flex-col gap-1">
              {week.map((day) => (
                <ActivityCell key={day.date} day={day} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ActivityDay } from "@/lib/time/activity-grid";
import { formatJournalDateLong } from "@/lib/time/journal-date";

/**
 * One day in a yearly activity calendar. Binary only: an entry exists or it
 * does not — no intensity (CLAUDE.md > Overview). Days that have an entry link
 * to that entry; empty past days link to a fresh entry for that date.
 */
export const ActivityCell = ({ day }: { day: ActivityDay }) => {
  if (!day.inYear) {
    return <span aria-hidden className="size-3 rounded-[3px]" />;
  }

  const label = `${formatJournalDateLong(day.date)}\n${
    day.filled ? "Journal entry" : "No journal entry"
  }`;

  if (day.isFuture) {
    return (
      <span
        title={label}
        className="size-3 rounded-[3px] border border-dashed border-border opacity-40"
      />
    );
  }

  return (
    <Link
      href={`/entries?date=${day.date}`}
      title={label}
      aria-label={label.replace("\n", " — ")}
      className={cn(
        "size-3 cursor-pointer rounded-[3px] border transition-colors",
        day.filled
          ? "border-primary bg-primary hover:brightness-110"
          : "border-border bg-muted hover:border-primary/50",
      )}
    />
  );
};

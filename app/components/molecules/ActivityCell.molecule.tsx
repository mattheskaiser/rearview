import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ActivityDay } from "@/lib/time/activity-grid";

/**
 * One day in the activity grid. Binary only: filled (entry exists) vs empty.
 * Padding cells outside the tracked range render as an invisible spacer.
 */
export const ActivityCell = ({ day }: { day: ActivityDay }) => {
  if (!day.inRange) {
    return <span aria-hidden className="size-3 rounded-[3px]" />;
  }

  return (
    <Link
      href={`/entries?date=${day.date}`}
      title={day.date}
      aria-label={
        day.filled ? `Entry on ${day.date}` : `No entry on ${day.date}`
      }
      className={cn(
        "size-3 rounded-[3px] border transition-colors",
        day.filled
          ? "border-primary bg-primary"
          : "border-border bg-neutral-200 hover:bg-secondary/60",
      )}
    />
  );
};

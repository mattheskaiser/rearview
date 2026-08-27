import { ActivityCell } from "@/app/components/molecules/ActivityCell.molecule";
import { ActivityLegend } from "@/app/components/molecules/ActivityLegend.molecule";
import { buildActivityGrid } from "@/lib/time/activity-grid";

type ActivityMapProps = {
  /** Dates with journal entries, as YYYY-MM-DD. */
  entryDates: string[];
};

/**
 * GitHub-style activity grid. The date range is derived from the data (earliest
 * entry through today), never hardcoded.
 */
export const ActivityMap = ({ entryDates }: ActivityMapProps) => {
  const { weeks, monthLabels } = buildActivityGrid(entryDates);
  const labelByColumn = new Map(monthLabels.map((m) => [m.column, m.label]));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
          Journal activity
        </h2>
        <ActivityLegend />
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-1 text-[10px] text-muted-foreground">
            {weeks.map((_, column) => (
              <span key={column} className="w-3">
                {labelByColumn.get(column) ?? ""}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            {weeks.map((week, column) => (
              <div key={column} className="flex flex-col gap-1">
                {week.map((day) => (
                  <ActivityCell key={day.date} day={day} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

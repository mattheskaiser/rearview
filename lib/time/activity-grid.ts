export type ActivityDay = {
  /** YYYY-MM-DD */
  date: string;
  /** Whether this cell falls inside [start, end]; padding cells are false. */
  inRange: boolean;
  /** Whether a journal entry exists on this date. */
  filled: boolean;
};

/** A column in the grid: 7 days, Sunday first. */
export type ActivityWeek = ActivityDay[];

export type ActivityGrid = {
  weeks: ActivityWeek[];
  /** Column index -> short month name, emitted when the month changes. */
  monthLabels: { column: number; label: string }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Parse YYYY-MM-DD as a UTC midnight timestamp (TZ-independent). */
function toUTC(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function format(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

/** Move a timestamp back to the Sunday (getUTCDay() === 0) of its week. */
function startOfWeek(ts: number): number {
  return ts - new Date(ts).getUTCDay() * DAY_MS;
}

/**
 * Builds a GitHub-style contribution grid from a set of entry dates.
 *
 * The range is derived from the data: it spans from the earliest entry date
 * (or `today` when there are no entries) through `today`. Nothing is hardcoded,
 * so the grid keeps growing as new entries are added.
 */
export function buildActivityGrid(
  entryDates: string[],
  today: Date = new Date(),
): ActivityGrid {
  const filledSet = new Set(entryDates);
  const endTs = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const startTs = entryDates.length
    ? Math.min(...entryDates.map(toUTC), endTs)
    : endTs;

  const gridStart = startOfWeek(startTs);
  const gridEnd = startOfWeek(endTs) + 6 * DAY_MS;

  const weeks: ActivityWeek[] = [];
  const monthLabels: { column: number; label: string }[] = [];
  let previousMonth = -1;

  for (let ts = gridStart, column = 0; ts <= gridEnd; column += 1) {
    const week: ActivityWeek = [];
    for (let i = 0; i < 7; i += 1, ts += DAY_MS) {
      const date = format(ts);
      week.push({
        date,
        inRange: ts >= startTs && ts <= endTs,
        filled: filledSet.has(date),
      });
    }
    const firstOfWeekMonth = new Date(week[0].date + "T00:00:00Z").getUTCMonth();
    if (firstOfWeekMonth !== previousMonth) {
      monthLabels.push({ column, label: MONTHS[firstOfWeekMonth] });
      previousMonth = firstOfWeekMonth;
    }
    weeks.push(week);
  }

  return { weeks, monthLabels };
}

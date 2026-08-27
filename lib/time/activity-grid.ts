/**
 * GitHub-style *yearly* journal activity calendars.
 *
 * The set of years and every date range are derived from the data — the
 * earliest entry through the latest entry (CLAUDE.md > Overview). Nothing is
 * hardcoded, so the map grows as entries are added and backfilled.
 *
 * All arithmetic is done on UTC timestamps so the grid is timezone-independent;
 * the caller decides which calendar day is "today" in the host timezone and
 * passes it in as `today` (`YYYY-MM-DD`).
 */

export type ActivityDay = {
  /** YYYY-MM-DD */
  date: string;
  /** False for padding cells that belong to an adjacent year. */
  inYear: boolean;
  /** Whether a journal entry exists on this date. */
  filled: boolean;
  /** Whether this date is after `today` (not yet reachable). */
  isFuture: boolean;
};

/** A column in the grid: 7 days, Sunday first. */
export type ActivityWeek = ActivityDay[];

export type YearGrid = {
  year: number;
  weeks: ActivityWeek[];
  /** Column index -> short month name, emitted when the month changes. */
  monthLabels: { column: number; label: string }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
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
 * Years that should appear in the activity map, ascending: the earliest entry
 * year through the latest entry year. Empty when there are no entries — the UI
 * shows an empty state instead.
 */
export function listActivityYears(entryDates: string[]): number[] {
  if (entryDates.length === 0) return [];
  const years = entryDates.map(yearOf);
  const first = Math.min(...years);
  const last = Math.max(...years);
  const out: number[] = [];
  for (let y = first; y <= last; y += 1) out.push(y);
  return out;
}

/**
 * Build one year's contribution calendar. The grid starts on the Sunday on or
 * before Jan 1 and ends on the Saturday on or after Dec 31, so weeks that
 * straddle a year boundary keep their padding days (marked `inYear: false`).
 * Leap years and month lengths fall out of the UTC date math.
 */
export function buildYearGrid(
  year: number,
  entryDates: Iterable<string>,
  today: string,
): YearGrid {
  const filledSet = entryDates instanceof Set ? entryDates : new Set(entryDates);
  const todayTs = Date.UTC(
    yearOf(today),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );

  const jan1 = Date.UTC(year, 0, 1);
  const dec31 = Date.UTC(year, 11, 31);
  const gridStart = startOfWeek(jan1);
  const gridEnd = startOfWeek(dec31) + 6 * DAY_MS;

  const weeks: ActivityWeek[] = [];
  const monthLabels: { column: number; label: string }[] = [];
  let previousLabelMonth = -1;

  for (let ts = gridStart, column = 0; ts <= gridEnd; column += 1) {
    const week: ActivityWeek = [];
    for (let i = 0; i < 7; i += 1, ts += DAY_MS) {
      const date = format(ts);
      week.push({
        date,
        inYear: yearOf(date) === year,
        filled: filledSet.has(date),
        isFuture: ts > todayTs,
      });
    }
    // Label a column by the first day of that column's week that is in-year.
    const anchor = week.find((d) => d.inYear);
    if (anchor) {
      const month = Number(anchor.date.slice(5, 7)) - 1;
      if (month !== previousLabelMonth) {
        monthLabels.push({ column, label: MONTHS[month] });
        previousLabelMonth = month;
      }
    }
    weeks.push(week);
  }

  return { year, weeks, monthLabels };
}

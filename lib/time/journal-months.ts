/**
 * Calendar-month helpers for the Journal Archive. A journal date is a
 * `YYYY-MM-DD` string (see {@link file://./journal-date.ts}); the month is read
 * straight off the string so it never shifts with a timezone.
 *
 * Pure — no DB, no environment.
 */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** 1-based calendar month (1–12) from a `YYYY-MM-DD` journal date. */
export function monthOf(journalDate: string): number {
  return Number(journalDate.slice(5, 7));
}

/** Full English month name for a 1-based month number, or "" if out of range. */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

/**
 * The distinct 1-based months present in `journalDates`, ascending. Feeds the
 * month filter so it only offers months the year actually has entries in.
 */
export function monthsWithEntries(journalDates: string[]): number[] {
  return [...new Set(journalDates.map(monthOf))].sort((a, b) => a - b);
}

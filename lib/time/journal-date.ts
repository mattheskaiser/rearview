/**
 * Journal dates are calendar dates, not instants. They are stored in Postgres
 * as `DATE` and represented in JS as a `Date` pinned to midnight UTC so that
 * the calendar day never shifts with the server's timezone.
 *
 * Pure helpers — no DB, no environment.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Format a Date as a `YYYY-MM-DD` string using its UTC calendar day. */
export function formatJournalDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Normalize a `YYYY-MM-DD` string or a Date to midnight-UTC of that calendar
 * day. Throws on a malformed string or an invalid calendar date.
 */
export function toJournalDate(input: string | Date): Date {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new Error("Invalid date");
    return new Date(
      Date.UTC(
        input.getUTCFullYear(),
        input.getUTCMonth(),
        input.getUTCDate(),
      ),
    );
  }

  if (!YMD.test(input)) {
    throw new Error(`Journal date must be YYYY-MM-DD, got "${input}"`);
  }
  const [y, m, d] = input.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error(`"${input}" is not a real calendar date`);
  }
  return date;
}

/**
 * `YYYY-MM-DD` for a Date read in the local timezone (default: now). Use this
 * for UI-facing "which calendar day is this" decisions — a date the user picks
 * in a calendar widget is a local calendar day, not a UTC instant.
 */
export function toLocalJournalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Human-readable label for a journal date, e.g. "Mar 4, 2022". */
export function formatJournalDateLabel(input: string | Date): string {
  return toJournalDate(input).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** True when `date`'s calendar day is strictly after `reference`'s. */
export function isFutureJournalDate(date: Date, reference: Date = new Date()): boolean {
  return toJournalDate(date).getTime() > toJournalDate(reference).getTime();
}

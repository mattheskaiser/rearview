/**
 * Forgiving date-string parsing for manual entry of historical journal dates.
 *
 * The user backfills entries from old paper journals, so typing "1/5/2022"
 * must Just Work without clicking through dozens of months. Parsing is pure and
 * deterministic; the result is always a real local calendar `Date` (midnight),
 * never a free-form string (CLAUDE.md > Journal Entries).
 */

/** Pivot for 2-digit years: 00-69 -> 2000s, 70-99 -> 1900s. */
function expandYear(raw: string): number {
  if (raw.length <= 2) {
    const n = Number(raw);
    return n < 70 ? 2000 + n : 1900 + n;
  }
  return Number(raw);
}

/** Build a local midnight Date, or null if the parts aren't a real date. */
function buildDate(year: number, month: number, day: number): Date | null {
  if (year < 1000 || year > 9999) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null; // e.g. 2/30 rolled over
  }
  return date;
}

/**
 * Parse common hand-typed date formats into a local `Date`:
 *   M/D/YYYY, MM/DD/YYYY, M-D-YYYY, M/D/YY  (month-first)
 *   YYYY-MM-DD, YYYY/MM/DD                  (ISO-ish, year-first)
 * Returns null for anything unrecognized or not a real calendar date.
 */
export function parseDateInput(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  const isoMatch = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) {
    return buildDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const mdyMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (mdyMatch) {
    return buildDate(
      expandYear(mdyMatch[3]),
      Number(mdyMatch[1]),
      Number(mdyMatch[2]),
    );
  }

  return null;
}

/** Canonical text form shown in the date field: `M/D/YYYY`. */
export function formatDateInput(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

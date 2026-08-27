/**
 * Runtime timezone resolution.
 *
 * Time-of-day decisions (the Overview greeting) and "which calendar day is it
 * now" (the activity map) must follow the clock of the machine running
 * Rearview, not a hardcoded zone. When the environment cannot report a usable
 * IANA zone we fall back to Pacific Time (CLAUDE.md > Overview).
 *
 * Pure helpers — no DB, no React. `Intl` is available in both Node and the
 * browser, so this works on the server and the client.
 */

export const FALLBACK_TIME_ZONE = "America/Los_Angeles";

/** The host's IANA timezone, or {@link FALLBACK_TIME_ZONE} when undeterminable. */
export function resolveTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return FALLBACK_TIME_ZONE;
    // Throws for an unknown zone; confirms Intl can actually use it.
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
};

/** Wall-clock calendar/time parts of `date` as seen in `timeZone`. */
export function getZonedParts(
  date: Date = new Date(),
  timeZone: string = resolveTimeZone(),
): ZonedParts {
  const format = (tz: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(date);

  let parts;
  try {
    parts = format(timeZone);
  } catch {
    parts = format(FALLBACK_TIME_ZONE);
  }

  const lookup = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    // Some engines emit "24" for midnight; normalize to 0.
    hour: lookup("hour") % 24,
  };
}

/** `YYYY-MM-DD` for the current calendar day in the host's timezone. */
export function zonedTodayString(
  date: Date = new Date(),
  timeZone: string = resolveTimeZone(),
): string {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

import { getZonedParts } from "@/lib/time/timezone";

export type GreetingPeriod = "morning" | "afternoon" | "evening";

/**
 * Maps an hour (0-23) to a greeting period using fixed cutoffs:
 *
 *   05:00 <= t < 12:00  -> "morning"
 *   12:00 <= t < 18:00  -> "afternoon"
 *   otherwise            -> "evening"  (18:00-04:59)
 */
export function periodFromHour(hour: number): GreetingPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

/** Greeting period from a Date's *local* hours (host clock). */
export function getGreeting(date: Date): GreetingPeriod {
  return periodFromHour(date.getHours());
}

/**
 * Greeting period for `date` as seen in `timeZone` (defaults to the resolved
 * host timezone). Use this on the server so the greeting follows the clock of
 * the machine running Rearview, wherever it runs.
 */
export function getZonedGreeting(
  date: Date = new Date(),
  timeZone?: string,
): GreetingPeriod {
  return periodFromHour(getZonedParts(date, timeZone).hour);
}

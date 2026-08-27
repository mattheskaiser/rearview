export type GreetingPeriod = "morning" | "afternoon" | "evening";

/**
 * Maps a local time of day to a greeting period using fixed cutoffs:
 *
 *   05:00 <= t < 12:00  -> "morning"
 *   12:00 <= t < 18:00  -> "afternoon"
 *   otherwise            -> "evening"  (18:00-04:59)
 *
 * Uses the provided Date's local hours so the greeting matches the user's clock.
 */
export function getGreeting(date: Date): GreetingPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

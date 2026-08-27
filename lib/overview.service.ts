import "server-only";

import { getGoals, upsertGoals } from "@/lib/db/goals";
import { listEntryDates } from "@/lib/db/journal";
import { env } from "@/lib/env";
import { goalsUpdateSchema } from "@/lib/validation/goals";

/**
 * Application-logic boundary for the Overview page (CLAUDE.md > Architecture).
 * The page and its server action call these; Prisma stays behind lib/db. The
 * page is intentionally simple — a greeting, current goals, journal activity.
 *
 * Goals text is user data (never journal content), so it is validated here
 * regardless of any client checks and never logged.
 */

export type OverviewData = {
  /** Greeting name from configuration, or undefined for a plain greeting. */
  name?: string;
  /** Current goals free text ("" when unset or the goals row is unreachable). */
  goals: string;
  /** Dates with a journal entry, `YYYY-MM-DD` ascending; [] when unreachable. */
  entryDates: string[];
};

/**
 * Assemble everything the Overview page renders. Each data source is isolated:
 * if the goals row or the entry-date query fails (e.g. the database is down),
 * that section degrades to an empty default instead of crashing the page.
 */
export async function getOverviewData(): Promise<OverviewData> {
  const [goals, entryDates] = await Promise.all([
    getGoals()
      .then((row) => row.text)
      .catch(() => ""),
    listEntryDates().catch(() => [] as string[]),
  ]);

  return { name: env.REARVIEW_USER_NAME, goals, entryDates };
}

export type SaveGoalsResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const SAVE_FAILED = "Could not save your goals. Please try again.";

/** Validate and persist the current goals text (empty is allowed). */
export async function saveGoals(input: unknown): Promise<SaveGoalsResult> {
  const parsed = goalsUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check your goals.",
    };
  }

  try {
    const row = await upsertGoals(parsed.data.text);
    return { ok: true, text: row.text };
  } catch {
    // Never surface DB internals / connection strings to the client.
    return { ok: false, error: SAVE_FAILED };
  }
}

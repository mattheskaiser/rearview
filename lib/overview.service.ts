import "server-only";

import type { JSONContent } from "@tiptap/core";
import type { Prisma } from "@prisma/client";

import { getGoals, upsertGoals } from "@/lib/db/goals";
import { listEntryDates } from "@/lib/db/journal";
import { env } from "@/lib/env";
import { getZonedGreeting, type GreetingPeriod } from "@/lib/time/greeting";
import { zonedTodayString } from "@/lib/time/timezone";
import { goalsUpdateSchema } from "@/lib/validation/goals";

/**
 * Application-logic boundary for the Overview page (CLAUDE.md > Architecture).
 * The page and its server action call these with the authenticated `userId`;
 * Prisma stays behind lib/db. The page is intentionally simple — a greeting,
 * current goals, journal activity — and every data source is scoped to the user.
 *
 * Goals text is user data (never journal content), so it is validated here
 * regardless of any client checks and never logged.
 */

/** Greeting name fallback for this personal app when nothing else is set. */
const DEFAULT_NAME = "Matthes";

export type OverviewData = {
  /** Name shown in the greeting. */
  name: string;
  /** Time-of-day period, resolved against the host machine's timezone. */
  greeting: GreetingPeriod;
  /** Saved goals as a TipTap document, or null when nothing is written yet. */
  goalsContent: JSONContent | null;
  /** Dates with a journal entry, `YYYY-MM-DD` ascending; [] when unreachable. */
  entryDates: string[];
  /** Today's calendar day in the host timezone, `YYYY-MM-DD`. */
  today: string;
};

/** A stored `content` value is only meaningful once it's a real `doc` node. */
function toDoc(value: unknown): JSONContent | null {
  if (value && typeof value === "object" && (value as JSONContent).type === "doc") {
    return value as JSONContent;
  }
  return null;
}

/**
 * Assemble everything the Overview page renders for `userId`. Each data source
 * is isolated: if the goals row or the entry-date query fails (e.g. the database
 * is down), that section degrades to an empty default instead of crashing the
 * page. `userName` is the authenticated account's name, preferred over the
 * configured fallback.
 */
export async function getOverviewData(
  userId: string,
  userName?: string,
): Promise<OverviewData> {
  const [goalsContent, entryDates] = await Promise.all([
    getGoals(userId)
      .then((row) => toDoc(row.content))
      .catch(() => null),
    listEntryDates(userId).catch(() => [] as string[]),
  ]);

  return {
    name: userName?.trim() || env.REARVIEW_USER_NAME || DEFAULT_NAME,
    greeting: getZonedGreeting(),
    goalsContent,
    entryDates,
    today: zonedTodayString(),
  };
}

export type SaveGoalsResult = { ok: true } | { ok: false; error: string };

const SAVE_FAILED = "Could not save your goals. Please try again.";

/** Validate and persist `userId`'s current goals document (empty is allowed). */
export async function saveGoals(
  userId: string,
  input: unknown,
): Promise<SaveGoalsResult> {
  const parsed = goalsUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check your goals.",
    };
  }

  try {
    await upsertGoals(userId, {
      content: parsed.data.content.content as Prisma.InputJsonValue,
      text: parsed.data.content.text,
    });
    return { ok: true };
  } catch {
    // Never surface DB internals / connection strings to the client.
    return { ok: false, error: SAVE_FAILED };
  }
}

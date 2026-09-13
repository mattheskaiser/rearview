"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/auth/session";
import { runBackup, type RunBackupResult } from "@/lib/backup.service";
import { saveGoals, type SaveGoalsResult } from "@/lib/overview.service";

export type SaveGoalsInput = {
  /** TipTap document JSON from the editor. Empty is allowed. */
  content: unknown;
};

/**
 * Server action behind the Overview page's Current Goals card. Authenticates
 * first (session prompt > Protected routes: server actions that modify private
 * data must check auth), then delegates validation and persistence to the
 * overview service, scoped to the caller.
 */
export async function saveGoalsAction(
  input: SaveGoalsInput,
): Promise<SaveGoalsResult> {
  const userId = await requireUserId();
  const result = await saveGoals(userId, input);
  if (result.ok) revalidatePath("/overview");
  return result;
}

/**
 * Server action behind the Overview page's manual "Back up now" button.
 * Snapshots journal entries, Memories and Current Goals to a local file
 * (lib/backup.service.ts) so the user can save recent work before trying
 * something risky.
 */
export async function triggerBackupAction(): Promise<RunBackupResult> {
  const userId = await requireUserId();
  const result = await runBackup(userId);
  if (result.ok) revalidatePath("/overview");
  return result;
}

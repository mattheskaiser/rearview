"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/auth/session";
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

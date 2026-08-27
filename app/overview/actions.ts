"use server";

import { revalidatePath } from "next/cache";

import { saveGoals, type SaveGoalsResult } from "@/lib/overview.service";

export type SaveGoalsInput = {
  /** Current goals free text. Empty is allowed. */
  text: string;
};

/**
 * Server action behind the Overview page's Current Goals card. Validation and
 * persistence live in the overview service; this only revalidates on success.
 */
export async function saveGoalsAction(
  input: SaveGoalsInput,
): Promise<SaveGoalsResult> {
  const result = await saveGoals(input);
  if (result.ok) revalidatePath("/overview");
  return result;
}

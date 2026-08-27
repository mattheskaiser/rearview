import { expect, type Page } from "@playwright/test";

/**
 * Helpers for driving the real Tiptap editor on the Entries page. Used only by
 * `entries-authoring.spec.ts`; the retrieval corpus is seeded through Prisma.
 */

const EDITOR = "Journal entry";
const DATE_FIELD = "Date of entry";

/** Navigate to the entry for `dateStr` (`YYYY-MM-DD`). */
export async function gotoEntry(page: Page, dateStr: string): Promise<void> {
  await page.goto(`/entries?date=${dateStr}`);
  await expect(page.getByLabel(EDITOR)).toBeVisible();
}

/** Type a date into the date field (M/D/YYYY) and commit it. */
export async function typeDate(page: Page, mdy: string): Promise<void> {
  const field = page.getByLabel(DATE_FIELD);
  await field.fill(mdy);
  await field.press("Enter");
}

/** Replace the editor contents with `text` and save; asserts the success line. */
export async function writeAndSave(page: Page, text: string): Promise<void> {
  const editor = page.getByLabel(EDITOR);
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await editor.pressSequentially(text);
  await saveEntry(page);
}

/** Click Save/Update and wait for the confirmation. */
export async function saveEntry(page: Page): Promise<void> {
  await page.getByRole("button", { name: /save entry|update entry/i }).click();
  await expect(page.getByText("Entry saved.")).toBeVisible();
}

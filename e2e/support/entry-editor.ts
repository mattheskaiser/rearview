import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Helpers for driving the real Tiptap editor.
 *
 * The Entries page is a blank composer only — a submitted entry never returns to
 * it. Existing entries are read and edited from the Journal Archive
 * (`/memories/journal/[year]`), where each entry is an accordion with a "⋯"
 * menu (Edit / Delete).
 */

const EDITOR = "Journal entry";
const EDIT_EDITOR = "Edit journal entry";
const DATE_FIELD = "Date of entry";

/** Navigate to the blank composer for `dateStr` (`YYYY-MM-DD`). */
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

async function replaceEditor(page: Page, editor: Locator, text: string) {
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await editor.pressSequentially(text);
}

/** Write a fresh entry for the current composer date and save it. */
export async function writeAndSave(page: Page, text: string): Promise<void> {
  const editor = page.getByLabel(EDITOR);
  await replaceEditor(page, editor, text);
  await page.getByRole("button", { name: /save entry/i }).click();
  await expect(page.getByText("Entry saved")).toBeVisible();
}

/** Go to a year page of the Journal Archive. */
export async function gotoArchiveYear(page: Page, year: number): Promise<void> {
  await page.goto(`/memories/journal/${year}`);
  await expect(
    page.getByRole("heading", { name: `Journal ${year}` }),
  ).toBeVisible();
}

/** The accordion article for the entry whose heading contains `dateText`. */
export function archiveEntry(page: Page, dateText: string): Locator {
  return page.getByRole("article").filter({ hasText: dateText });
}

/** Expand an archive entry and return its content region. */
export async function openArchiveEntry(
  page: Page,
  dateText: string,
): Promise<Locator> {
  const article = archiveEntry(page, dateText);
  const toggle = article.getByRole("button", { name: dateText, exact: false });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  return article;
}

/** Edit an archive entry's text in place and save. */
export async function editArchiveEntry(
  page: Page,
  dateText: string,
  text: string,
): Promise<void> {
  const article = archiveEntry(page, dateText);
  await article.getByRole("button", { name: "Entry actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editor = article.getByLabel(EDIT_EDITOR);
  await replaceEditor(page, editor, text);
  await article.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Entry updated")).toBeVisible();
}

/** Delete an archive entry via its "⋯" menu, confirming the prompt. */
export async function deleteArchiveEntry(
  page: Page,
  dateText: string,
): Promise<void> {
  const article = archiveEntry(page, dateText);
  await article.getByRole("button", { name: "Entry actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await article.getByRole("button", { name: "Delete entry" }).click();
  await expect(page.getByText("Entry deleted")).toBeVisible();
}

import { test, expect } from "../fixtures/app.fixture";
import { toJournalDate } from "@/lib/time/journal-date";

import {
  gotoEntry,
  openEditor,
  savedEntry,
  saveEntry,
  typeDate,
  writeAndSave,
} from "../support/entry-editor";

/**
 * Journal authoring through the real editor (plan §12: entries-authoring ~9).
 * All dates are in 2020–2021, outside the retrieval corpus, so these never
 * perturb the seeded evidence.
 *
 * A date that already has an entry opens read-only; the editor is revealed with
 * "Edit entry" (see `openEditor`).
 */

const countFor = (prisma: import("@prisma/client").PrismaClient, date: string) =>
  prisma.journalEntry.count({ where: { journalDate: toJournalDate(date) } });

test("writes a new entry for a backdated date", async ({ authedPage: page }) => {
  await gotoEntry(page, "2021-01-04");
  await writeAndSave(page, "Backdated from an old paper journal.");

  await gotoEntry(page, "2021-01-04");
  await expect(savedEntry(page)).toContainText(
    "Backdated from an old paper journal.",
  );
});

test("backdates via the typed date field", async ({ authedPage: page }) => {
  await gotoEntry(page, "2021-02-01");
  await typeDate(page, "6/12/2021");
  await expect(page).toHaveURL(/date=2021-06-12/);
  await writeAndSave(page, "Reached this date by typing it.");
  expect(await page.url()).toContain("date=2021-06-12");
});

test("rejects a future date", async ({ authedPage: page }) => {
  await gotoEntry(page, "2021-03-03");
  await typeDate(page, "12/31/2099");
  await expect(page.getByText(/that date is in the future/i)).toBeVisible();
  await expect(page).not.toHaveURL(/2099/);
});

test("bold text round-trips through save and reload", async ({ authedPage: page }) => {
  await gotoEntry(page, "2021-04-10");
  const editor = await openEditor(page);
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await editor.pressSequentially("plain then ");
  await page.getByRole("button", { name: "Bold" }).click();
  await editor.pressSequentially("strong");
  await saveEntry(page);

  await gotoEntry(page, "2021-04-10");
  await expect(savedEntry(page).locator("strong")).toHaveText("strong");
});

test("italic text round-trips through save and reload", async ({ authedPage: page }) => {
  await gotoEntry(page, "2021-05-11");
  const editor = await openEditor(page);
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await editor.pressSequentially("plain then ");
  await page.getByRole("button", { name: "Italic" }).click();
  await editor.pressSequentially("leaning");
  await saveEntry(page);

  await gotoEntry(page, "2021-05-11");
  await expect(savedEntry(page).locator("em")).toHaveText("leaning");
});

test("a bulleted list round-trips through save and reload", async ({ authedPage: page }) => {
  await gotoEntry(page, "2021-06-20");
  const editor = await openEditor(page);
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.getByRole("button", { name: "Bulleted list" }).click();
  await editor.pressSequentially("first item");
  await page.keyboard.press("Enter");
  await editor.pressSequentially("second item");
  await saveEntry(page);

  await gotoEntry(page, "2021-06-20");
  await expect(savedEntry(page).locator("li")).toHaveCount(2);
});

test("a numbered list round-trips through save and reload", async ({
  authedPage: page,
}) => {
  await gotoEntry(page, "2021-11-12");
  const editor = await openEditor(page);
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.getByRole("button", { name: "Numbered list" }).click();
  await editor.pressSequentially("first step");
  await page.keyboard.press("Enter");
  await editor.pressSequentially("second step");
  await saveEntry(page);

  await gotoEntry(page, "2021-11-12");
  await expect(savedEntry(page).locator("ol li")).toHaveCount(2);
});

test("a submitted entry does not return to the composer", async ({
  authedPage: page,
}) => {
  await gotoEntry(page, "2021-10-05");
  await writeAndSave(page, "A quick note to file away.");

  // Right after saving: read-only, no editable surface holding the text.
  await expect(savedEntry(page)).toContainText("A quick note to file away.");
  await expect(page.getByLabel("Journal entry")).toHaveCount(0);

  // Navigate away and back — still read-only, editor still empty of it.
  await page.goto("/overview");
  await gotoEntry(page, "2021-10-05");
  await expect(savedEntry(page)).toContainText("A quick note to file away.");
  await expect(page.getByLabel("Journal entry")).toHaveCount(0);

  // A fresh date opens an empty editor.
  await gotoEntry(page, "2021-10-06");
  await expect(page.getByLabel("Journal entry")).toBeVisible();
  await expect(page.getByLabel("Journal entry")).not.toContainText(
    "A quick note to file away.",
  );
});

test("editing an entry updates it in place", async ({ authedPage: page, prisma }) => {
  await gotoEntry(page, "2021-07-15");
  await writeAndSave(page, "First version of this day.");
  await writeAndSave(page, "Second version, fully rewritten.");

  expect(await countFor(prisma, "2021-07-15")).toBe(1);
  await gotoEntry(page, "2021-07-15");
  await expect(savedEntry(page)).toContainText("Second version, fully rewritten.");
  await expect(savedEntry(page)).not.toContainText("First version");
});

test("one entry per calendar day", async ({ authedPage: page, prisma }) => {
  await gotoEntry(page, "2021-08-08");
  await writeAndSave(page, "Only entry for this date.");
  await gotoEntry(page, "2021-08-08");
  await expect(page.getByRole("button", { name: "Edit entry" })).toBeVisible();
  await writeAndSave(page, "Still only one row after a second save.");
  expect(await countFor(prisma, "2021-08-08")).toBe(1);
});

test("a saved entry generates embeddings asynchronously", async ({
  authedPage: page,
  prisma,
  waitForEmbeddings,
}) => {
  await gotoEntry(page, "2021-09-09");
  await writeAndSave(
    page,
    "A distinctive backdated note about repairing an old wooden canoe by the lake.",
  );

  await waitForEmbeddings(["2021-09-09"]);
  const embedded = await prisma.entryChunk.count({
    where: {
      embeddedAt: { not: null },
      entry: { journalDate: toJournalDate("2021-09-09") },
    },
  });
  expect(embedded).toBeGreaterThan(0);
});

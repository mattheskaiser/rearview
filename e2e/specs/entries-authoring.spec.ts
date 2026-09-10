import { test, expect } from "../fixtures/app.fixture";
import { toJournalDate } from "@/lib/time/journal-date";

import {
  archiveEntry,
  deleteArchiveEntry,
  editArchiveEntry,
  gotoArchiveYear,
  gotoEntry,
  openArchiveEntry,
  typeDate,
  writeAndSave,
} from "../support/entry-editor";

/**
 * Journal authoring through the real editor. All dates are in 2020–2021,
 * outside the retrieval corpus, so these never perturb the seeded evidence.
 *
 * The Entries page is a blank composer; a saved entry is read / edited / deleted
 * from the Journal Archive.
 */

const countFor = (prisma: import("@prisma/client").PrismaClient, date: string) =>
  prisma.journalEntry.count({ where: { journalDate: toJournalDate(date) } });

test("writes a new entry for a backdated date and finds it in the archive", async ({
  authedPage: page,
}) => {
  await gotoEntry(page, "2021-01-04");
  await writeAndSave(page, "Backdated from an old paper journal.");

  await gotoArchiveYear(page, 2021);
  const article = await openArchiveEntry(page, "January 4th 2021");
  await expect(article).toContainText("Backdated from an old paper journal.");
});

test("the composer never shows a submitted entry again", async ({
  authedPage: page,
}) => {
  await gotoEntry(page, "2021-10-05");
  await writeAndSave(page, "A quick note to file away.");

  // Editor clears and stays; the text is gone from the box.
  await expect(page.getByLabel("Journal entry")).toBeVisible();
  await expect(page.getByLabel("Journal entry")).not.toContainText(
    "A quick note to file away.",
  );

  // Revisiting the date: still a blank composer, plus a hint pointing at the
  // archive — not the saved text.
  await page.goto("/overview");
  await gotoEntry(page, "2021-10-05");
  await expect(page.getByLabel("Journal entry")).not.toContainText(
    "A quick note to file away.",
  );
  await expect(page.getByText(/already have an entry for this date/i)).toBeVisible();
});

test("a second entry for the same date is refused with a toast", async ({
  authedPage: page,
  prisma,
}) => {
  await gotoEntry(page, "2021-08-08");
  await writeAndSave(page, "Only entry for this date.");

  await gotoEntry(page, "2021-08-08");
  const editor = page.getByLabel("Journal entry");
  await editor.click();
  await editor.pressSequentially("Trying to add another.");
  await page.getByRole("button", { name: /save entry/i }).click();

  await expect(page.getByText(/already have an entry for this date/i)).toBeVisible();
  expect(await countFor(prisma, "2021-08-08")).toBe(1);
});

test("backdates via the typed date field", async ({ authedPage: page }) => {
  await gotoEntry(page, "2021-02-01");
  await typeDate(page, "6/12/2021");
  await expect(page).toHaveURL(/date=2021-06-12/);
  await writeAndSave(page, "Reached this date by typing it.");
  expect(page.url()).toContain("date=2021-06-12");
});

test("rejects a future date", async ({ authedPage: page }) => {
  await gotoEntry(page, "2021-03-03");
  await typeDate(page, "12/31/2099");
  await expect(page.getByText(/that date is in the future/i)).toBeVisible();
  await expect(page).not.toHaveURL(/2099/);
});

test("bold text round-trips through save and the archive", async ({
  authedPage: page,
}) => {
  await gotoEntry(page, "2021-04-10");
  const editor = page.getByLabel("Journal entry");
  await editor.click();
  await editor.pressSequentially("plain then ");
  await page.getByRole("button", { name: "Bold" }).click();
  await editor.pressSequentially("strong");
  await page.getByRole("button", { name: /save entry/i }).click();
  await expect(page.getByText("Entry saved")).toBeVisible();

  await gotoArchiveYear(page, 2021);
  const article = await openArchiveEntry(page, "April 10th 2021");
  await expect(article.locator("strong")).toHaveText("strong");
});

test("a numbered list round-trips through save and the archive", async ({
  authedPage: page,
}) => {
  await gotoEntry(page, "2021-11-12");
  const editor = page.getByLabel("Journal entry");
  await editor.click();
  await page.getByRole("button", { name: "Numbered list" }).click();
  await editor.pressSequentially("first step");
  await page.keyboard.press("Enter");
  await editor.pressSequentially("second step");
  await page.getByRole("button", { name: /save entry/i }).click();
  await expect(page.getByText("Entry saved")).toBeVisible();

  await gotoArchiveYear(page, 2021);
  const article = await openArchiveEntry(page, "November 12th 2021");
  await expect(article.locator("ol li")).toHaveCount(2);
});

test("edits an entry in place from the archive", async ({
  authedPage: page,
  prisma,
}) => {
  await gotoEntry(page, "2021-07-15");
  await writeAndSave(page, "First version of this day.");

  await gotoArchiveYear(page, 2021);
  await editArchiveEntry(page, "July 15th 2021", "Second version, fully rewritten.");

  await gotoArchiveYear(page, 2021);
  const article = await openArchiveEntry(page, "July 15th 2021");
  await expect(article).toContainText("Second version, fully rewritten.");
  await expect(article).not.toContainText("First version");
  expect(await countFor(prisma, "2021-07-15")).toBe(1);
});

test("deletes an entry from the archive", async ({ authedPage: page, prisma }) => {
  await gotoEntry(page, "2021-12-20");
  await writeAndSave(page, "This one gets removed.");

  await gotoArchiveYear(page, 2021);
  await deleteArchiveEntry(page, "December 20th 2021");

  await expect(archiveEntry(page, "December 20th 2021")).toHaveCount(0);
  await expect
    .poll(() => countFor(prisma, "2021-12-20"))
    .toBe(0);
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

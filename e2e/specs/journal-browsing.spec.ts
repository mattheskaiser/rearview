import { test, expect } from "../fixtures/app.fixture";

/**
 * The Journal tab on the Memories page: browse seeded entries by year, open one,
 * and see the required date heading plus the original editor formatting.
 */

const HEADING_RE =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}(st|nd|rd|th) \d{4}$/;

async function openJournalTab(page: import("@playwright/test").Page) {
  await page.goto("/memories");
  await page.getByRole("tab", { name: "Journal" }).click();
}

test("lists the years that contain entries and switches between them", async ({
  authedPage: page,
}) => {
  await openJournalTab(page);
  const yearNav = page.getByRole("navigation", { name: "Journal year" });

  // The synthetic corpus spans 2022–2026.
  for (const year of ["2022", "2023", "2024", "2025", "2026"]) {
    await expect(yearNav.getByRole("button", { name: year })).toBeVisible();
  }

  await yearNav.getByRole("button", { name: "2022" }).click();
  await expect(
    page.getByRole("button", { name: /January 8th 2022/ }),
  ).toBeVisible();
});

test("an entry shows its date as a heading in the required format", async ({
  authedPage: page,
}) => {
  await openJournalTab(page);
  await page
    .getByRole("navigation", { name: "Journal year" })
    .getByRole("button", { name: "2022" })
    .click();

  const headings = page.locator("article h3 button");
  await expect(headings.first()).toBeVisible();
  const count = await headings.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    expect(((await headings.nth(i).textContent()) ?? "").trim()).toMatch(
      HEADING_RE,
    );
  }
});

test("opening an entry renders its original formatting (bullet list)", async ({
  authedPage: page,
  prisma,
}) => {
  // Entry n=1 (2022-01-08) has no list; find a corpus entry that does.
  const withBullet = await prisma.journalEntry.findFirstOrThrow({
    where: { contentText: { contains: "\n- " } },
    select: { journalDate: true },
    orderBy: { journalDate: "asc" },
  });
  const year = String(withBullet.journalDate.getUTCFullYear());

  await openJournalTab(page);
  await page
    .getByRole("navigation", { name: "Journal year" })
    .getByRole("button", { name: year })
    .click();

  // Open every entry for that year until we see a rendered <li>.
  const articles = page.locator("article");
  await expect(articles.first()).toBeVisible();
  for (let i = 0; i < (await articles.count()); i += 1) {
    await articles.nth(i).locator("h3 button").click();
  }
  await expect(page.locator("article li").first()).toBeVisible();
});

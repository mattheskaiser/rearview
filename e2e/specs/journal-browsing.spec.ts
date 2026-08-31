import { test, expect } from "../fixtures/app.fixture";

/**
 * The Journal Archive on the Memories page: a shelf of yearly volume cards,
 * each opening `/memories/journal/[year]` where the year's entries are browsed
 * with a month filter, the required date heading, and original editor
 * formatting.
 */

const HEADING_RE =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}(st|nd|rd|th) \d{4}$/;

test("the archive lists one volume per year with entries, newest first", async ({
  authedPage: page,
}) => {
  await page.goto("/memories");
  const archive = page.getByRole("region", { name: "Journal Archive" });
  await expect(archive).toBeVisible();

  // The synthetic corpus spans 2022–2026.
  const labels = await archive
    .getByRole("link")
    .evaluateAll((els) => els.map((el) => el.textContent?.match(/\d{4}/)?.[0]));
  expect(labels).toEqual(["2026", "2025", "2024", "2023", "2022"]);
});

test("clicking a volume opens that year's route with its entries", async ({
  authedPage: page,
}) => {
  await page.goto("/memories");
  await page
    .getByRole("region", { name: "Journal Archive" })
    .getByRole("link", { name: /Journal 2022/ })
    .click();

  await expect(page).toHaveURL(/\/memories\/journal\/2022$/);
  await expect(page.getByRole("heading", { name: "Journal 2022" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /January 8th 2022/ }),
  ).toBeVisible();
});

test("direct navigation works and every entry heading is in the required format", async ({
  authedPage: page,
}) => {
  await page.goto("/memories/journal/2022");

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

test("the month filter narrows the list without leaving the page", async ({
  authedPage: page,
}) => {
  await page.goto("/memories/journal/2022");
  const filter = page.getByRole("group", { name: "Filter entries by month" });

  // Only months the year actually has entries in are offered.
  await expect(filter.getByRole("button", { name: "January" })).toBeVisible();
  await expect(filter.getByRole("button", { name: "August" })).toHaveCount(0);

  const before = await page.locator("article").count();
  await filter.getByRole("button", { name: "January" }).click();

  await expect(page).toHaveURL(/\/memories\/journal\/2022$/);
  await expect(
    filter.getByRole("button", { name: "January" }),
  ).toHaveAttribute("aria-pressed", "true");
  const after = await page.locator("article").count();
  expect(after).toBeLessThan(before);
  await expect(
    page.getByRole("button", { name: /January 8th 2022/ }),
  ).toBeVisible();

  // Back to All restores the full list.
  await filter.getByRole("button", { name: "All" }).click();
  await expect(page.locator("article")).toHaveCount(before);
});

test("opening an entry renders its original formatting (bullet list)", async ({
  authedPage: page,
  prisma,
}) => {
  const withBullet = await prisma.journalEntry.findFirstOrThrow({
    where: { contentText: { contains: "\n- " } },
    select: { journalDate: true },
    orderBy: { journalDate: "asc" },
  });
  const year = String(withBullet.journalDate.getUTCFullYear());

  await page.goto(`/memories/journal/${year}`);
  const articles = page.locator("article");
  await expect(articles.first()).toBeVisible();
  for (let i = 0; i < (await articles.count()); i += 1) {
    await articles.nth(i).locator("h3 button").click();
  }
  await expect(page.locator("article li").first()).toBeVisible();
});

test("the back link returns to the Memories page", async ({
  authedPage: page,
}) => {
  await page.goto("/memories/journal/2024");
  await page.getByRole("link", { name: "Back to Memories" }).click();
  await expect(page).toHaveURL(/\/memories$/);
  await expect(page.getByRole("heading", { name: "Memories" })).toBeVisible();
});

test("a year with no entries shows a clear empty state with a way back", async ({
  authedPage: page,
}) => {
  await page.goto("/memories/journal/1999");
  await expect(page.getByText("No entries from 1999")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to Memories" }),
  ).toBeVisible();
});

test("a non-year segment is handled gracefully", async ({ authedPage: page }) => {
  await page.goto("/memories/journal/not-a-year");
  await expect(page.getByText(/is not a valid year/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to Memories" }),
  ).toBeVisible();
});

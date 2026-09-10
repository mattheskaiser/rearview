import { test, expect } from "@playwright/test";

import { CORPUS } from "../fixtures/corpus";

/**
 * Overview activity map (plan §12: activity-map ~5). Data-driven from the seeded
 * corpus — no hardcoded ranges (CLAUDE.md > Overview).
 */

const countInYear = (year: number) =>
  CORPUS.filter((e) => e.date.startsWith(`${year}-`)).length;

test.beforeEach(async ({ page }) => {
  await page.goto("/overview");
  await expect(
    page.getByRole("heading", { name: "Journal activity" }),
  ).toBeVisible();
});

test("year nav lists every year the corpus spans, newest selected", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Activity year" });
  for (const year of [2022, 2023, 2024, 2025, 2026]) {
    await expect(nav.getByRole("button", { name: String(year) })).toBeVisible();
  }
  await expect(nav.getByRole("button", { name: "2026" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("a seeded date is a filled cell linking to its year in the archive", async ({ page }) => {
  await page.getByRole("button", { name: "2024" }).click();
  const cell = page.locator('a[href="/memories/journal/2024"]').first();
  await expect(cell).toHaveAttribute("title", /Journal entry/);
  await cell.click();
  await expect(page).toHaveURL(/\/memories\/journal\/2024$/);
  await expect(
    page.getByRole("heading", { name: "Journal 2024" }),
  ).toBeVisible();
});

test("an empty past date links to the composer for that date", async ({ page }) => {
  await page.getByRole("button", { name: "2024" }).click();
  const empty = page.locator('a[href="/entries?date=2024-01-10"]');
  await expect(empty).toHaveAttribute("title", /No journal entry/);
});

test("selecting a year swaps the calendar", async ({ page }) => {
  await page.getByRole("button", { name: "2022" }).click();
  await expect(
    page.locator('a[href="/memories/journal/2022"]').first(),
  ).toBeVisible();
  await expect(page.locator('a[href="/memories/journal/2024"]')).toHaveCount(0);
});

test("the current year stops at today — no future cells", async ({ page }) => {
  await page.getByRole("button", { name: "2026" }).click();

  // The grid ends at today, so a late-December cell never renders.
  expect(await page.locator('span[title*="December 25, 2026"]').count()).toBe(0);
  await expect(page.locator("span.border-dashed")).toHaveCount(0);

  // The corpus dates in 2026 are all present as real, filled cells that open
  // the 2026 archive.
  const filled2026 = page.locator('a.bg-primary[href="/memories/journal/2026"]');
  await expect(filled2026).toHaveCount(countInYear(2026));
});

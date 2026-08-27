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

test("a seeded date is a filled cell linking to its entry", async ({ page }) => {
  await page.getByRole("button", { name: "2024" }).click();
  const cell = page.locator('a[href="/entries?date=2024-07-12"]');
  await expect(cell).toHaveAttribute("title", /Journal entry/);
  await cell.click();
  await expect(page).toHaveURL(/\/entries\?date=2024-07-12/);
  await expect(page.getByLabel("Journal entry")).toContainText("España");
});

test("an empty past date is a non-filled cell", async ({ page }) => {
  await page.getByRole("button", { name: "2024" }).click();
  const empty = page.locator('a[href="/entries?date=2024-01-10"]');
  await expect(empty).toHaveAttribute("title", /No journal entry/);
});

test("selecting a year swaps the calendar", async ({ page }) => {
  await page.getByRole("button", { name: "2022" }).click();
  await expect(page.locator('a[href="/entries?date=2022-01-08"]')).toBeVisible();
  await expect(page.locator('a[href="/entries?date=2024-07-12"]')).toHaveCount(0);
});

test("future dates render as dashed, non-clickable cells", async ({ page }) => {
  await page.getByRole("button", { name: "2026" }).click();
  const future = page.locator('span[title*="December 25, 2026"]');
  await expect(future).toBeVisible();
  await expect(future).toHaveClass(/border-dashed/);
  expect(await page.locator('a[href="/entries?date=2026-12-25"]').count()).toBe(0);

  // The corpus dates in 2026 are all present as real cells.
  const filled2026 = page.locator('a.bg-primary[href^="/entries?date=2026-"]');
  await expect(filled2026).toHaveCount(countInYear(2026));
});

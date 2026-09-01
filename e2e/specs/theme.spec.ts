import { test, expect } from "@playwright/test";

/**
 * Dark mode toggle: accessible from the Sidebar on every authenticated page,
 * persists across reload, and defaults to the OS preference when the user has
 * never chosen explicitly.
 */

const isDark = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

test.beforeEach(async ({ page }) => {
  await page.goto("/overview");
  await page.evaluate(() => localStorage.removeItem("rearview-theme"));
});

test("toggling switches the theme and persists it across reload", async ({ page }) => {
  const startedDark = await isDark(page);
  const toggle = page.getByRole("button", { name: /switch to (dark|light) theme/i });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect
    .poll(() => isDark(page))
    .toBe(!startedDark);

  await page.reload();
  await expect
    .poll(() => isDark(page))
    .toBe(!startedDark);
});

test("the toggle is reachable from another top-level page too", async ({ page }) => {
  await page.goto("/entries");
  await expect(
    page.getByRole("button", { name: /switch to (dark|light) theme/i }),
  ).toBeVisible();
});

test("defaults to the OS preference when no explicit choice was ever saved", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect.poll(() => isDark(page)).toBe(true);

  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect.poll(() => isDark(page)).toBe(false);
});

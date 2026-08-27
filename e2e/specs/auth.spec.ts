import { test, expect } from "@playwright/test";

import { TEST_ACCOUNT } from "../fixtures/test-account";

/**
 * Auth mechanics (plan §12: auth ~6). The single account is created in global
 * setup, so registration is already locked here.
 *
 * NOTE: the shared storage state points at one session row. Tests that sign out
 * (which deletes that row) must first sign in fresh in a clean context, never
 * use the shared session — otherwise every later spec is bounced to /login.
 */

test.describe("signed in (shared session)", () => {
  test("visiting /login while signed in redirects to /overview", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/overview$/);
  });

  test("an authenticated user reaches the private pages", async ({ page }) => {
    await page.goto("/memories");
    await expect(page).toHaveURL(/\/memories$/);
    await expect(
      page.getByRole("heading", { name: "Memories", exact: true }),
    ).toBeVisible();
  });
});

test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("private routes redirect to /login", async ({ page }) => {
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/memories");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("registration is closed once an account exists", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText(/registration is closed/i)).toBeVisible();
  });

  test("wrong password shows a generic error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ACCOUNT.email);
    await page.getByLabel("Password").fill("wrong-password-9");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(/don'?t match/i);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("correct credentials sign in and land on /overview", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ACCOUNT.email);
    await page.getByLabel("Password").fill(TEST_ACCOUNT.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/overview$/);
  });

  test("signing out ends the session and re-gates the app", async ({ page }) => {
    // Fresh session so signing out cannot disturb the shared one.
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ACCOUNT.email);
    await page.getByLabel("Password").fill(TEST_ACCOUNT.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/overview$/);

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/login$/);
  });
});

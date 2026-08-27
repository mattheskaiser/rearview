import { test, expect } from "../fixtures/app.fixture";

import { gotoEntry, writeAndSave } from "../support/entry-editor";

/**
 * Runs against the `ollama-down` project — a second app instance whose
 * OLLAMA_BASE_URL points at a dead port. The journal must keep working when
 * inference is unavailable (plan §12: ollama-down ~3; CLAUDE.md > Error
 * Handling).
 */

test("asking the journal shows a useful AI-unavailable state", async ({ ask }) => {
  const out = await ask("Was hat mich 2023 beschäftigt?");
  expect(out.error).toMatch(/not reachable right now|local ai/i);
  expect(out.evidenceDates).toEqual([]);
});

test("writing and saving an entry still works", async ({ authedPage: page }) => {
  await gotoEntry(page, "2020-05-05");
  await writeAndSave(page, "Wrote this while the local AI was offline. Still saved.");

  await gotoEntry(page, "2020-05-05");
  await expect(page.getByLabel("Journal entry")).toContainText("Still saved.");
});

test("the overview page still loads", async ({ authedPage: page }) => {
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "Journal activity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

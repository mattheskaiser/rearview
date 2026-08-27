import { test, expect } from "../fixtures/app.fixture";

/**
 * Memories: ask → save → list → persist → delete (plan §12: memories ~5).
 */

const QUESTION = "Wann habe ich angefangen, Spanisch zu lernen?";

test.describe.serial("save and manage a memory", () => {
  test("an answer renders with the AI-generated badge and journal evidence", async ({
    ask,
    authedPage: page,
  }) => {
    const out = await ask(QUESTION);
    expect(out.error).toBeNull();
    expect(out.answer.length).toBeGreaterThan(0);
    expect(out.evidenceDates).toContain("2024-01-19");
    await expect(page.getByText("AI-generated")).toBeVisible();
    await expect(page.getByRole("heading", { name: "From your journal" })).toBeVisible();
  });

  test("saving keeps the question, answer and cited dates", async ({
    ask,
    authedPage: page,
    prisma,
  }) => {
    await ask(QUESTION);
    await page.getByRole("button", { name: "Save as Memory" }).click();
    await expect(page.getByText(/saved to your memories/i)).toBeVisible();

    const card = page.getByRole("article").filter({ hasText: QUESTION });
    await expect(card).toBeVisible();
    await expect(card.locator('a[href="/entries?date=2024-01-19"]')).toBeVisible();

    const memory = await prisma.memory.findFirstOrThrow({
      where: { question: QUESTION },
      include: { entries: true },
    });
    expect(memory.answer.length).toBeGreaterThan(0);
    expect(memory.entries.length).toBeGreaterThan(0);
  });

  test("the saved memory survives a reload", async ({ authedPage: page }) => {
    await page.goto("/memories");
    await expect(page.getByRole("article").filter({ hasText: QUESTION })).toBeVisible();
  });

  test("deleting removes it from the list and the database", async ({
    authedPage: page,
    prisma,
  }) => {
    await page.goto("/memories");
    const card = page.getByRole("article").filter({ hasText: QUESTION });
    await card.getByRole("button", { name: /delete memory/i }).click();
    await expect(card).toHaveCount(0);
    await expect
      .poll(() => prisma.memory.count({ where: { question: QUESTION } }))
      .toBe(0);
  });

  test("the empty state shows once nothing is saved", async ({ authedPage: page }) => {
    await page.goto("/memories");
    await expect(page.getByText(/no saved memories yet/i)).toBeVisible();
  });
});

test("the Stop button aborts generation and keeps what streamed", async ({
  authedPage: page,
}) => {
  const placeholder = "Ask your journal a question…";
  await page.goto("/memories");
  const panel = page
    .locator("section")
    .filter({ has: page.getByPlaceholder(placeholder) })
    .first();

  await panel.getByPlaceholder(placeholder).fill("Was hat mich 2023 beschäftigt?");
  await panel.getByRole("button", { name: "Ask" }).click();

  // Evidence renders first, then the answer starts streaming.
  await expect(panel.locator("a[data-evidence-card]").first()).toBeVisible({
    timeout: 120_000,
  });
  const answer = panel.locator("p[data-answer]");
  const stop = panel.getByRole("button", { name: "Stop" });
  await stop.waitFor({ state: "visible", timeout: 120_000 });

  // Let a meaningful amount of text stream in (caret ▍ stripped).
  const streamedText = async () =>
    ((await answer.textContent()) ?? "").replace(/▍/g, "").trim();
  await expect.poll(async () => (await streamedText()).length, { timeout: 120_000 })
    .toBeGreaterThan(20);
  const partial = await streamedText();

  await stop.click();

  await expect(stop).toBeHidden();
  await expect(panel.getByText(/stopped/i)).toBeVisible();
  // Whatever streamed is kept (abort may add a few more tokens first) and saveable.
  expect(await streamedText()).toContain(partial.slice(0, 15));
  await expect(
    panel.getByRole("button", { name: "Save as Memory" }),
  ).toBeVisible();
  await expect(panel.locator("a[data-evidence-card]").first()).toBeVisible();
});

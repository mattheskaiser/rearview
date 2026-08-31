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

test("an AI search keeps running and its state survives a tab switch", async ({
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

  // Evidence appears (retrieval done); the answer is now streaming.
  await expect(panel.locator("a[data-evidence-card]").first()).toBeVisible({
    timeout: 120_000,
  });

  // Leave for the Journal tab and come back — mid-flight.
  await page.getByRole("tab", { name: "Journal" }).click();
  await expect(panel).toBeHidden();
  await page.getByRole("tab", { name: "Reflect" }).click();

  // The search was not reset: evidence is still there and the answer either is
  // still streaming or has finished — never gone.
  await expect(panel.locator("a[data-evidence-card]").first()).toBeVisible();
  const answer = panel.locator("[data-answer]");
  const stop = panel.getByRole("button", { name: "Stop" });
  const save = panel.getByRole("button", { name: "Save as Memory" });
  await expect(answer.or(stop).or(save).first()).toBeVisible({ timeout: 280_000 });

  // Let it settle and confirm real text arrived.
  await stop.waitFor({ state: "hidden", timeout: 280_000 }).catch(() => {});
  expect(((await answer.textContent()) ?? "").replace(/▍/g, "").trim().length)
    .toBeGreaterThan(20);
});

test("a long saved memory is truncated but can be expanded and collapsed", async ({
  authedPage: page,
  prisma,
}) => {
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const paragraphs = Array.from(
    { length: 12 },
    (_, i) => `Absatz ${i + 1}: eine ausführliche, mehrzeilige Reflexion über das Jahr.`,
  ).join("\n\n");
  await prisma.memory.create({
    data: {
      userId: user.id,
      question: "Ein langer Rückblick?",
      answer: paragraphs,
      answerDoc: {
        type: "doc",
        content: paragraphs.split("\n\n").map((text) => ({
          type: "paragraph",
          content: [{ type: "text", text }],
        })),
      },
    },
  });

  try {
    await page.goto("/memories");
    const card = page.getByRole("article").filter({ hasText: "Ein langer Rückblick?" });
    await expect(card).toBeVisible();

    const body = card.locator("[data-answer-body]");
    const heightOf = async () => (await body.boundingBox())?.height ?? 0;

    const showMore = card.getByRole("button", { name: "Show more" });
    await expect(showMore).toBeVisible();
    const collapsed = await heightOf();
    expect(collapsed).toBeLessThanOrEqual(140); // clamped preview

    await showMore.click();
    const expanded = await heightOf();
    expect(expanded).toBeGreaterThan(collapsed);
    // The full stored text is present, not discarded.
    expect((await body.textContent()) ?? "").toContain("Absatz 12:");

    await card.getByRole("button", { name: "Show less" }).click();
    expect(await heightOf()).toBeLessThanOrEqual(140);
  } finally {
    await prisma.memory.deleteMany({ where: { question: "Ein langer Rückblick?" } });
  }
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
  const answer = panel.locator("[data-answer]");
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

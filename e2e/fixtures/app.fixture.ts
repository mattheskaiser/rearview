import { test as base, expect, type Locator, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

import { prisma as prismaClient } from "@/lib/db/client";
import { toJournalDate } from "@/lib/time/journal-date";

/** Outcome of one ask through the Memories UI. */
export type AskOutcome = {
  /** Synthesized answer text, or "" when the ask errored. */
  answer: string;
  /** Distinct journal dates from the evidence chip hrefs, in chip order. */
  evidenceDates: string[];
  /** User-facing error text when the ask failed (Ollama down, no evidence). */
  error: string | null;
};

type AppFixtures = {
  prisma: PrismaClient;
  authedPage: Page;
  ask: (question: string) => Promise<AskOutcome>;
  waitForEmbeddings: (dates: string[]) => Promise<void>;
};

const QUESTION_PLACEHOLDER = "Ask your journal a question…";
const RETRIEVAL_TIMEOUT = 120_000;
const GENERATION_TIMEOUT = 280_000;

/** Distinct journal dates from the evidence chip/card hrefs, in DOM order. */
async function readEvidenceDates(scope: Locator): Promise<string[]> {
  const hrefs = await scope
    .locator('a[href*="/entries?date="]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const href of hrefs) {
    const match = href.match(/date=(\d{4}-\d{2}-\d{2})/);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      dates.push(match[1]);
    }
  }
  return dates;
}

export const test = base.extend<AppFixtures>({
  prisma: async ({}, use) => {
    await use(prismaClient);
  },

  // The default `page` already carries the saved storage state (playwright
  // config `use.storageState`); this alias just documents the intent.
  authedPage: async ({ page }, use) => {
    await use(page);
  },

  ask: async ({ page }, use) => {
    const askOnce = async (question: string): Promise<AskOutcome> => {
      if (!page.url().includes("/memories")) {
        await page.goto("/memories");
      }
      const panel = page
        .locator("section")
        .filter({ has: page.getByPlaceholder(QUESTION_PLACEHOLDER) })
        .first();

      const textarea = panel.getByPlaceholder(QUESTION_PLACEHOLDER);
      await textarea.fill("");
      await textarea.fill(question);
      await panel.getByRole("button", { name: "Ask" }).click();

      const cards = panel.locator("a[data-evidence-card]");
      // `[data-answer]` is a <p> while tokens stream and a rich <div> once the
      // answer settles into editor-native formatting.
      const answer = panel.locator("[data-answer]");
      const alert = panel.getByRole("alert");
      const stop = panel.getByRole("button", { name: "Stop" });

      // Phase 1 — retrieval-first: the evidence cards, or an error, appear fast.
      await expect(cards.first().or(alert).first()).toBeVisible({
        timeout: RETRIEVAL_TIMEOUT,
      });
      if ((await cards.count()) === 0 && (await alert.isVisible())) {
        return {
          answer: "",
          evidenceDates: [],
          error: (await alert.textContent())?.trim() ?? "",
        };
      }

      // Phase 2 — the answer streams in; wait for Stop to go away (done /
      // stopped / errored). There is no fixed generation timeout in the app.
      await stop
        .waitFor({ state: "visible", timeout: 10_000 })
        .catch(() => {});
      await stop.waitFor({ state: "hidden", timeout: GENERATION_TIMEOUT });

      const evidenceDates = await readEvidenceDates(panel);
      const midStreamError = (await alert.isVisible())
        ? (await alert.textContent())?.trim() ?? ""
        : null;
      const answerText = (await answer.count())
        ? (await answer.textContent())?.trim() ?? ""
        : "";

      // A stall / Ollama drop mid-stream with no text is a failure; partial
      // text plus an error still counts as an answer the user could save.
      if (midStreamError && !answerText) {
        return { answer: "", evidenceDates, error: midStreamError };
      }
      return { answer: answerText, evidenceDates, error: null };
    };

    // A cold llama3.1 load can trip the stall watchdog on the very first call of
    // a run; global setup warms it, but retry a transient "AI unavailable" a few
    // more times here. The ollama-down project's error is steady, so it still
    // surfaces.
    await use(async (question: string): Promise<AskOutcome> => {
      let out = await askOnce(question);
      for (let i = 0; i < 3 && /not reachable right now|local ai/i.test(out.error ?? ""); i += 1) {
        await new Promise((r) => setTimeout(r, 10_000));
        out = await askOnce(question);
      }
      return out;
    });
  },

  waitForEmbeddings: async ({ prisma }, use) => {
    await use(async (dates: string[]) => {
      const journalDates = dates.map((d) => toJournalDate(d));
      const deadline = Date.now() + 300_000;
      while (Date.now() < deadline) {
        const [pending, total] = await Promise.all([
          prisma.entryChunk.count({
            where: { embeddedAt: null, entry: { journalDate: { in: journalDates } } },
          }),
          prisma.entryChunk.count({
            where: { entry: { journalDate: { in: journalDates } } },
          }),
        ]);
        if (total > 0 && pending === 0) return;
        await new Promise((r) => setTimeout(r, 1_500));
      }
      throw new Error(`waitForEmbeddings timed out for ${dates.join(", ")}`);
    });
  },
});

export { expect };

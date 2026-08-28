import { test, expect } from "../fixtures/app.fixture";
import { runReflection } from "../support/reflection";

import { CORPUS } from "../fixtures/corpus";
import { seedCorpus } from "../seed/seed";

/**
 * Negative retrieval (plan §7 / §11). The corpus always returns 6 excerpts
 * (plan §0.2), so N1–N3/N5/N7 assert on the *answer* — did the model correctly
 * say it doesn't know? — graded on the uncertainty rubric (loose, one retry).
 * N4 is a retrieval-precision assertion; N6 is the only true empty-evidence
 * path and rebuilds the corpus in `afterAll`.
 */

test("N4 — exam stress is disambiguated from work stress", async ({ ask }) => {
  await runReflection(ask, {
    id: "N4",
    question: "Wann war ich vor einer Prüfung nervös?",
    queryLang: "de",
    tier: "must",
    expectRelevantDates: ["2022-04-11"],
    expectTopDate: "2022-04-11",
    expectAnswerIncludes: [/prüfung|exam|zertifi|certification|nervös|2022/i],
  });
});

test("N1 — no entries about children", async ({ ask }) => {
  await runReflection(ask, {
    id: "N1",
    question: "Was habe ich über meine Kinder geschrieben?",
    queryLang: "de",
    tier: "should",
    expectUncertainty: true,
  });
});

test("N2 — no entries about a pet", async ({ ask }) => {
  await runReflection(ask, {
    id: "N2",
    question: "What was my dog's name?",
    queryLang: "en",
    tier: "should",
    expectUncertainty: true,
  });
});

test("N3 — the journal doesn't record body weight", async ({ ask }) => {
  await runReflection(ask, {
    id: "N3",
    question: "Wie viel wiege ich?",
    queryLang: "de",
    tier: "should",
    expectUncertainty: true,
  });
});

test("N5 — no fabricated 2027 plans", async ({ ask }) => {
  await runReflection(ask, {
    id: "N5",
    question: "What are my plans for 2027?",
    queryLang: "en",
    tier: "should",
    expectUncertainty: true,
  });
});

test("N7 — trained for a half marathon but never raced", async ({ ask }) => {
  await runReflection(ask, {
    id: "N7",
    question: "Was habe ich über das Laufen und den Halbmarathon geschrieben?",
    queryLang: "de",
    tier: "nice",
    // The running/training cluster must surface; the real assertion is that the
    // model never invents a race day (a finish time or a "ran the half" claim).
    expectAnswerIncludes: [/halbmarathon|marathon|lauf|training/i],
    expectAnswerExcludes: [
      /(gelaufen|absolviert|finished|completed|ran)\b[^.]{0,40}(halbmarathon|half.?marathon|21[.,]?\d*\s?km)/i,
      /\b[12]:[0-5]\d(:[0-5]\d)?\s*(h|std|hours|stunden)?\b/i,
    ],
  });
});

test.describe.serial("N6 — the true empty-evidence path", () => {
  test.beforeAll(async ({ prisma }) => {
    const users = await prisma.user.findMany({ select: { id: true } });
    await prisma.entryChunk.deleteMany({
      where: { entry: { userId: { in: users.map((u) => u.id) } } },
    });
  });

  test.afterAll(async ({ prisma, waitForEmbeddings }) => {
    test.setTimeout(6 * 60 * 1000);
    const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
    await seedCorpus(user.id);
    await waitForEmbeddings(CORPUS.map((e) => e.date));
  });

  test("returns the NO_EVIDENCE copy when there are no embedded chunks", async ({ ask }) => {
    const out = await ask("Was habe ich letzten Sommer gemacht?");
    expect(out.error).toMatch(/no journal entries seem related/i);
    expect(out.evidenceDates).toEqual([]);
  });
});

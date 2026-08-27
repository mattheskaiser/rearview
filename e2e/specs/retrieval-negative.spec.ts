import { test, expect } from "../fixtures/app.fixture";
import { runReflection } from "../support/reflection";

import { CORPUS } from "../fixtures/corpus";
import { seedCorpus } from "../seed/seed";

/**
 * Negative retrieval — the Must subset (plan §11: N4, N6). The remaining N cases
 * (generation-grounding, "Should" tier) are in e2e/specs/TODO.md.
 *
 * This file runs last among the retrieval specs (alphabetical) and N6 rebuilds
 * the corpus in `afterAll`, so it must not run before other retrieval files.
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

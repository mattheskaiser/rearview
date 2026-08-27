import { test } from "../fixtures/app.fixture";
import { runReflection, type ReflectionSpec } from "../support/reflection";

/**
 * Adversarial retrieval — the Must subset (plan §11: X8, X10). The rest of the
 * X cases are in e2e/specs/TODO.md.
 */

const SPECS: ReflectionSpec[] = [
  {
    id: "X8",
    question: "An welchem Tag habe ich gekündigt?",
    queryLang: "de",
    tier: "difficult",
    expectRelevantDates: ["2024-10-01"],
    expectTopDate: "2024-10-01",
    // The quit date is in the text (15 Sept), not the journal date (1 Oct).
    expectAnswerIncludes: [/15\.?\s*(september|sept)/i],
  },
  {
    id: "X10",
    question: "Was stand auf meiner Zieleliste für 2024?",
    queryLang: "de",
    tier: "must",
    expectRelevantDates: ["2024-01-07"],
    expectTopDate: "2024-01-07",
    // ≥3 of the four list items: (office|Spanish) + write + trip.
    expectAnswerIncludes: [
      /büro|office|job|spanisch|spanish/i,
      /schreib|writ/i,
      /reise|trip|travel/i,
    ],
  },
];

for (const spec of SPECS) {
  test(`${spec.id} — ${spec.question}`, async ({ ask }) => {
    await runReflection(ask, spec);
  });
}

import { test } from "../fixtures/app.fixture";
import { runReflection, type ReflectionSpec } from "../support/reflection";

/**
 * Category A — exact factual retrieval, the Must subset (plan §11: A1, A2, A4,
 * A5, A7, A8). The remaining A/F cases are listed in e2e/specs/TODO.md.
 *
 * Query wording is calibrated to what the seeded corpus + bge-m3 actually
 * retrieve (plan §0: "every expectation is calibrated to the current
 * implementation"). Evidence-date assertions are strict; answer-content
 * assertions are loose regexes with one retry (plan §10).
 */

const SPECS: ReflectionSpec[] = [
  {
    id: "A1",
    question: "Wann hatte ich meine erste Spanischstunde?",
    queryLang: "de",
    tier: "must",
    expectRelevantDates: ["2024-01-19"],
    expectTopDate: "2024-01-19",
    expectAnswerIncludes: [/2024|januar|january/i],
  },
  {
    id: "A2",
    question: "What were my goals for 2024?",
    queryLang: "en",
    tier: "must",
    expectRelevantDates: ["2024-01-07"],
    expectTopDate: "2024-01-07",
    expectMultiEntry: true,
    expectAnswerIncludes: [/spanish|spanisch/i, /trip|reise|travel|office|büro|job/i],
  },
  {
    id: "A4",
    question: "Wann habe ich gekündigt?",
    queryLang: "de",
    tier: "must",
    expectRelevantDates: ["2024-10-01"],
    expectTopDate: "2024-10-01",
    expectAnswerIncludes: [/15\.?\s*(september|sept)/i],
  },
  {
    id: "A5",
    question: "What did I set as my goal for 2025?",
    queryLang: "en",
    tier: "must",
    expectRelevantDates: ["2025-01-06"],
    expectTopDate: "2025-01-06",
    expectAnswerIncludes: [
      /freelance|selbstständ|income|einkommen/i,
      /write|schreib|morning|morgen/i,
    ],
  },
  {
    id: "A7",
    question: "Welches sportliche Ziel habe ich aufgegeben?",
    queryLang: "de",
    tier: "must",
    // #14 (the 2023 abandonment) and #43 (the 2025 "glad I let it go") both count.
    expectRelevantDates: ["2023-03-27", "2025-05-18"],
    minRelevant: 1,
    expectAnswerIncludes: [/half.?marathon|halbmarathon|marathon|lauf/i],
  },
  {
    id: "A8",
    question: "Wann hatte ich zwei Wochen Urlaub ohne Arbeit?",
    queryLang: "de",
    tier: "must",
    expectRelevantDates: ["2024-07-12"],
    expectTopDate: "2024-07-12",
    expectAnswerIncludes: [/spanien|spain|españa/i],
  },
];

for (const spec of SPECS) {
  test(`${spec.id} — ${spec.question}`, async ({ ask }) => {
    await runReflection(ask, spec);
  });
}

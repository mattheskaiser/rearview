import { test } from "../fixtures/app.fixture";
import { runReflection, type ReflectionSpec } from "../support/reflection";

/**
 * Category A — exact factual retrieval — and Category F — specific-occurrence
 * retrieval (plan §6 / §11).
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
  {
    id: "A3",
    question: "Was habe ich über den Umzug geschrieben?",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: ["2023-05-06"],
    expectTopDate: "2023-05-06",
    // The Mexico trip (#56) and the "golden cage" entry (#34) must not dominate.
    expectAbsentDates: ["2026-05-03", "2024-09-16"],
    expectAnswerIncludes: [/wohnung|umzug|zog|zieh|kisten/i],
  },
  {
    id: "A6",
    question: "Wie viel Rücklage hatte ich Anfang 2025?",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: ["2025-02-11"],
    expectTopDate: "2025-02-11",
    // llama3.1 reliably surfaces the €8,400 figure but often drops the
    // "~5 months" framing, so only the figure is asserted.
    expectAnswerIncludes: [/8[.,]?400|8400/],
  },
  {
    id: "F1",
    question: "When did I first mention wanting to change careers?",
    queryLang: "en",
    tier: "difficult",
    expectRelevantDates: ["2023-10-21"],
    expectTopDate: "2023-10-21",
    expectAbsentDates: ["2024-02-14", "2024-09-16"],
    expectAnswerIncludes: [/2023|october|oktober/i],
  },
  {
    id: "F2",
    question:
      "Zeig mir alle Einträge, in denen ich mich ausgebrannt gefühlt habe.",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: ["2023-06-18", "2023-09-05"],
    expectAbsentDates: ["2022-04-11", "2024-08-14"],
    expectMultiEntry: true,
    expectAnswerIncludes: [/2023|ausgebrannt|burn/i],
  },
  {
    id: "F3",
    question: "Wann habe ich über eine große Auslandsreise geschrieben?",
    queryLang: "de",
    tier: "difficult",
    expectRelevantDates: ["2026-05-03"],
    expectTopDate: "2026-05-03",
    // The 2023 flat move is a local move, not this.
    expectAbsentDates: ["2023-05-06"],
    expectAnswerIncludes: [/mexiko|mexico|reise|trip|ausland/i],
  },
  {
    id: "F4",
    question: "Every entry about working on my novel.",
    queryLang: "en",
    tier: "must",
    expectRelevantDates: [
      "2022-09-03",
      "2023-11-30",
      "2025-06-07",
      "2026-03-08",
    ],
    minRelevant: 3,
    // #29 (2024-04-01) is about reading a novel, not writing one.
    expectAbsentDates: ["2024-04-01"],
    expectMultiEntry: true,
    expectAnswerIncludes: [/roman|novel/i],
  },
  {
    id: "F5",
    question: "Wann habe ich einen ruhigen Tag auf dem Balkon verbracht?",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: ["2024-05-04"],
    expectTopDate: "2024-05-04",
    // #5 (2022-05-09) is relief after the exam, not contentment.
    expectAbsentDates: ["2022-05-09"],
    expectAnswerIncludes: [/balkon|balcony|buch|book|2024/i],
  },
];

for (const spec of SPECS) {
  test(`${spec.id} — ${spec.question}`, async ({ ask }) => {
    await runReflection(ask, spec);
  });
}

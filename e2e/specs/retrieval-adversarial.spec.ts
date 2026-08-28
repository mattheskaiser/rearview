import { test } from "../fixtures/app.fixture";
import { runReflection, type ReflectionSpec } from "../support/reflection";

/**
 * Adversarial retrieval (plan §8 / §11): short entries, typos, indirect
 * expression, keyword traps, number-as-date traps, contradictions and the
 * diversity cap. X8/X10 are Must; the rest are Should/Nice.
 *
 * Query wording is calibrated to what the seeded corpus actually retrieves
 * (plan §0). X15 uses the same calibrated "2023" phrasing as V1 in
 * retrieval-semantic (plan §11 lists both).
 */

const DATES_2023 = [
  "2023-01-05",
  "2023-02-02",
  "2023-03-09",
  "2023-03-27",
  "2023-04-18",
  "2023-05-06",
  "2023-06-18",
  "2023-07-30",
  "2023-09-05",
  "2023-10-02",
  "2023-10-21",
  "2023-11-14",
  "2023-11-30",
  "2023-12-20",
];

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
  {
    id: "X1",
    question: "Wann hatte ich einen unproduktiven, müden Tag?",
    queryLang: "de",
    tier: "should",
    // #49 is three words long — it must still be retrievable.
    expectRelevantDates: ["2025-11-02"],
    expectTopDate: "2025-11-02",
    expectAnswerIncludes: [/müde|tired|wenig|unproduktiv|2025/i],
  },
  {
    id: "X4",
    question:
      "When did I just want to get out of the office and away from my boss?",
    queryLang: "en",
    tier: "should",
    // #33 — lowercase, typo-ridden German — retrieved from a clean English query.
    expectRelevantDates: ["2024-08-14"],
    expectTopDate: "2024-08-14",
    expectAnswerIncludes: [/2024|büro|office|chef|boss|weg|out/i],
  },
  {
    id: "X9",
    question: "Wie viele Monate Rücklage hatte ich noch?",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: ["2025-02-11"],
    expectTopDate: "2025-02-11",
    expectAnswerIncludes: [
      /fünf|five|\b5\b|monat|month/i,
      /8[.,]?400|8400|1[.,]?700|1700/,
    ],
  },
  {
    id: "X11",
    question: "Wann bin ich in alte Arbeitsmuster zurückgefallen?",
    queryLang: "de",
    tier: "nice",
    // #48 has a repeated paragraph; the diversity cap keeps it to ≤2 chunks, so
    // it still surfaces as exactly one evidence date.
    expectRelevantDates: ["2025-10-05"],
    expectTopDate: "2025-10-05",
    expectAnswerIncludes: [
      /2025|rückfall|muster|durchgearbeitet|old pattern|relapse/i,
    ],
  },
  {
    id: "X12",
    question: "Did I think going freelance was the right call?",
    queryLang: "en",
    tier: "difficult",
    // The Nov 2024 conviction (#37) and the March 2025 doubt (#41) — both.
    expectRelevantDates: ["2024-11-08", "2025-03-09"],
    expectMultiEntry: true,
    expectAnswerIncludes: [/freelance|selbstständ|2024|2025/i],
  },
  {
    id: "X13",
    question:
      "When did I feel emotionally flat and going through the motions?",
    queryLang: "en",
    tier: "should",
    // #19 — burnout expressed without the word.
    expectRelevantDates: ["2023-09-05"],
    expectTopDate: "2023-09-05",
    expectAnswerIncludes: [/2023|funktion|grau|flat|going through/i],
  },
  {
    id: "X14",
    question: "running on empty, exhausted by my job",
    queryLang: "en",
    tier: "should",
    expectRelevantDates: ["2023-06-18", "2023-09-05"],
    minRelevant: 1,
    expectAnswerIncludes: [/2023|erschöpft|exhaust|ausgebrannt|burn/i],
  },
  {
    id: "X15",
    question:
      "Wie war das Jahr, in dem ich im Büro ausgebrannt bin und die Beziehung darunter litt?",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: DATES_2023,
    minRelevant: 3,
    expectMultiEntry: true,
    expectAnswerIncludes: [/2023|stress|ausgebrannt|burn/i],
  },
  {
    id: "X16",
    question: "When did I burn out?",
    queryLang: "en",
    tier: "nice",
    expectRelevantDates: ["2023-06-18"],
    expectTopDate: "2023-06-18",
    expectAnswerIncludes: [/2023|burn|ausgebrannt|june|juni/i],
  },
  {
    id: "X17",
    question: "Wie viele Jahre lerne ich schon Spanisch?",
    queryLang: "de",
    tier: "nice",
    // #57 ("dos años") is the answer; the "2022"/"2023" year mentions elsewhere
    // must not confuse it.
    expectRelevantDates: ["2026-06-21"],
    expectTopDate: "2026-06-21",
    expectAnswerIncludes: [/zwei jahre|2 jahre|two years|dos años/i],
  },
];

for (const spec of SPECS) {
  test(`${spec.id} — ${spec.question}`, async ({ ask }) => {
    await runReflection(ask, spec);
  });
}

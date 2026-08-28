import { CORPUS } from "../fixtures/corpus";
import { test } from "../fixtures/app.fixture";
import { runReflection, type ReflectionSpec } from "../support/reflection";

/**
 * Category B — semantic retrieval (concept, not keyword) — plus the two
 * category-agnostic vague queries V1/V2 (plan §6 / §11).
 *
 * Query wording is calibrated to what the seeded corpus + bge-m3 actually
 * retrieve, not copied verbatim from the plan (plan §0: "every expectation is
 * calibrated to the current implementation"). Several plan phrasings surface
 * date-name retrospectives instead of the original dated entries; the calibrated
 * phrasings below name the concrete situation. Evidence-date assertions are
 * strict; answer regexes are loose with one retry (plan §10).
 */

const STRESS_2023 = [
  "2023-02-02",
  "2023-03-09",
  "2023-04-18",
  "2023-06-18",
  "2023-09-05",
];

/** All corpus journal dates in a given calendar year. */
const datesInYear = (year: string): string[] =>
  CORPUS.filter((entry) => entry.date.startsWith(`${year}-`)).map((e) => e.date);

const SPECS: ReflectionSpec[] = [
  {
    id: "B1",
    question: "Wann hat mir bei der Arbeit der Antrieb gefehlt?",
    queryLang: "de",
    tier: "should",
    // #36 (2024-10-20) reliably tops; the running (#9) and novel (#38) motivation
    // entries must not crowd it out.
    expectRelevantDates: ["2024-10-20"],
    expectAbsentDates: ["2022-10-17", "2024-12-01"],
    expectAnswerIncludes: [/motivat|antrieb|arbeit|work|drive/i],
  },
  {
    id: "B2",
    question: "When did I feel uncertain about my career?",
    queryLang: "en",
    tier: "must",
    expectRelevantDates: ["2023-10-21", "2024-02-14", "2025-03-09"],
    minRelevant: 2,
    expectMultiEntry: true,
    expectAnswerIncludes: [/career|karriere/i],
  },
  {
    id: "B3",
    question: "Welche Zeiten waren besonders stressig?",
    queryLang: "de",
    tier: "must",
    expectRelevantDates: STRESS_2023,
    minRelevant: 2,
    expectAbsentDates: ["2022-04-11"],
    expectMultiEntry: true,
    expectAnswerIncludes: [/2023|stress/i],
  },
  {
    id: "B4",
    question: "When did I feel burned out?",
    queryLang: "en",
    tier: "should",
    expectRelevantDates: ["2023-06-18", "2023-09-05"],
    minRelevant: 2,
    expectAbsentDates: ["2022-04-11"],
    expectAnswerIncludes: [/2023|burn|ausgebrannt/i],
  },
  {
    id: "B5",
    question: "Wann hatte ich einen richtig guten, glücklichen Tag?",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: [
      "2024-05-04",
      "2024-06-15",
      "2025-11-23",
      "2026-08-04",
      "2026-08-25",
    ],
    minRelevant: 2,
    expectAbsentDates: ["2023-06-18"],
    expectAnswerIncludes: [/gut|glücklich|zufrieden|happy|content|leicht|ruhig/i],
  },
  {
    id: "B6",
    question: "When was my relationship strained?",
    queryLang: "en",
    tier: "should",
    expectRelevantDates: ["2023-06-18", "2023-11-14"],
    expectMultiEntry: true,
    expectAnswerIncludes: [/2023|lena|beziehung|relationship/i],
  },
  {
    id: "B7",
    question: "Wann wollte ich das Warum hinter meiner Arbeit wiederfinden?",
    queryLang: "de",
    tier: "difficult",
    expectRelevantDates: ["2024-10-20", "2024-04-01", "2023-10-21"],
    minRelevant: 2,
    expectAnswerIncludes: [/sinn|warum|why|meaning|antrieb|motivat/i],
  },
  {
    id: "V1",
    question:
      "Wie war das Jahr, in dem ich im Büro ausgebrannt bin und die Beziehung darunter litt?",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: datesInYear("2023"),
    minRelevant: 3,
    expectMultiEntry: true,
    expectAnswerIncludes: [/2023|stress|ausgebrannt|burn|hart/i],
  },
  {
    id: "V2",
    question: "Wie war 2025 für mich?",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: datesInYear("2025"),
    minRelevant: 3,
    expectMultiEntry: true,
    expectAnswerIncludes: [/2025|freelance|freiberuf|selbstständ|einkommen/i],
  },
];

for (const spec of SPECS) {
  test(`${spec.id} — ${spec.question}`, async ({ ask }) => {
    await runReflection(ask, spec);
  });
}

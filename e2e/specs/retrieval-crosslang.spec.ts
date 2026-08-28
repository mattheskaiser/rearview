import { test } from "../fixtures/app.fixture";
import { runReflection, type ReflectionSpec } from "../support/reflection";

/**
 * Cross-language retrieval + long-entry adversarials (plan §9 / §11). The Must
 * direction set (E1, E2, E3, E5, X2, X3) plus the remaining Category E and the
 * mixed-entry cases X5–X7. Each query's only correct evidence is in another
 * language, hidden at the end of / inside a long entry, or in an entry that
 * code-switches between languages.
 *
 * The 2023 stress cluster in the corpus is #12/#13/#15/#17/#19; a query only
 * needs to surface ≥2 of them (plan §0: calibrated to the implementation).
 */

const STRESS_2023 = [
  "2023-02-02",
  "2023-03-09",
  "2023-04-18",
  "2023-06-18",
  "2023-09-05",
];

const SPECS: ReflectionSpec[] = [
  {
    id: "E1",
    question: "Wann war ich unsicher, was meine Karriere angeht?",
    queryLang: "de",
    tier: "must",
    expectRelevantDates: ["2023-10-21", "2024-02-14"],
    minRelevant: 2,
    expectMultiEntry: true,
    expectAnswerIncludes: [/career|karriere|freelance|selbstständ|change|wechsel/i],
  },
  {
    id: "E2",
    question: "When was I overwhelmed by work?",
    queryLang: "en",
    tier: "must",
    expectRelevantDates: STRESS_2023,
    minRelevant: 2,
    expectAbsentDates: ["2022-04-11"],
    expectMultiEntry: true,
    expectAnswerIncludes: [/2023/i],
  },
  {
    id: "E3",
    question: "¿Cuándo estuve al límite por el trabajo?",
    queryLang: "es",
    tier: "must",
    expectRelevantDates: STRESS_2023,
    minRelevant: 2,
    expectAnswerIncludes: [/2023/i],
  },
  {
    id: "E5",
    question: "When did I go on a real holiday away from work?",
    queryLang: "en",
    tier: "must",
    expectRelevantDates: ["2024-07-12", "2025-08-22"],
    minRelevant: 1,
    expectAnswerIncludes: [/spain|españa|spanien|portugal/i],
  },
  {
    id: "X2",
    question: "When did I admit I was burned out?",
    queryLang: "en",
    tier: "must",
    expectRelevantDates: ["2023-06-18"],
    expectAbsentDates: ["2022-04-11"],
    expectAnswerIncludes: [/june 2023|juni 2023|2023-06|mid-?2023|summer 2023|2023/i],
  },
  {
    id: "X3",
    question: "Wie war ein typischer Montag im Büro?",
    queryLang: "de",
    tier: "must",
    expectRelevantDates: ["2024-04-01"],
    expectTopDate: "2024-04-01",
    expectAnswerIncludes: [/montag|monday|inbox|meeting|mail/i],
  },
  {
    id: "E4",
    question: "Wann habe ich mich optimistischer wegen der Arbeit gefühlt?",
    queryLang: "de",
    tier: "should",
    // Only the Spanish 2026-02-15 entry qualifies (de query → es evidence).
    expectRelevantDates: ["2026-02-15"],
    expectTopDate: "2026-02-15",
    expectAnswerIncludes: [/optimist|arbeit|work|2026/i],
  },
  {
    id: "E6",
    question:
      "¿Cuándo escribí que dejar la oficina y hacerme autónomo fue la mejor decisión?",
    queryLang: "es",
    tier: "should",
    // es query → en evidence (#37).
    expectRelevantDates: ["2024-11-08"],
    expectTopDate: "2024-11-08",
    expectAnswerIncludes: [
      /2024|freelance|autónomo|selbstständ|decision|entscheidung/i,
    ],
  },
  {
    id: "E7",
    question:
      "Notiz über Motivation und das Weitermachen, wenn es schwer ist",
    queryLang: "de",
    tier: "should",
    // de query → mixed de+en entry (#38).
    expectRelevantDates: ["2024-12-01"],
    expectTopDate: "2024-12-01",
    expectAnswerIncludes: [/2024|weiter|roman|motivat|keep going/i],
  },
  {
    id: "E8",
    question: "¿Cuándo hablé solo en español con un amigo?",
    queryLang: "es",
    tier: "should",
    // es query → mixed de+es entry (#45).
    expectRelevantDates: ["2025-07-10"],
    expectAnswerIncludes: [/2025|tomás|tomas|spanisch|spanish|español/i],
  },
  {
    id: "X5",
    question:
      "Wann habe ich mir vorgenommen, trotz Schwierigkeiten weiterzumachen?",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: ["2024-12-01"],
    expectAnswerIncludes: [/2024|weiter|schwer|roman/i],
  },
  {
    id: "X6",
    question: "When did I have a full conversation in Spanish?",
    queryLang: "en",
    tier: "should",
    expectRelevantDates: ["2025-07-10"],
    expectAnswerIncludes: [
      /2025|spanish|spanisch|español|tomás|tomas/i,
    ],
  },
  {
    id: "X7",
    question: "Was war mein Neujahrs-Check-in Anfang 2026?",
    queryLang: "de",
    tier: "should",
    expectRelevantDates: ["2026-01-20"],
    expectTopDate: "2026-01-20",
    expectAnswerIncludes: [/2026|freelance|reise|trip|schreib|objetivos/i],
  },
];

for (const spec of SPECS) {
  test(`${spec.id} — ${spec.question}`, async ({ ask }) => {
    await runReflection(ask, spec);
  });
}

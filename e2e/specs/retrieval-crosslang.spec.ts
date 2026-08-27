import { test } from "../fixtures/app.fixture";
import { runReflection, type ReflectionSpec } from "../support/reflection";

/**
 * Cross-language retrieval + long-entry adversarials — the Must direction set
 * (plan §9 / §11: E1, E2, E3, E5, X2, X3). Each query's only correct evidence
 * is in another language, or hidden at the end of / inside a long entry.
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
];

for (const spec of SPECS) {
  test(`${spec.id} — ${spec.question}`, async ({ ask }) => {
    await runReflection(ask, spec);
  });
}

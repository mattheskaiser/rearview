# E2E retrieval specs — status

The harness (corpus, seed, fixtures, grading model) and **all** the retrieval /
UI specs from `docs/testing/retrieval-e2e-plan.md` §6 / §11 are now implemented.
Each row is one `ReflectionSpec` graded through `runReflection(ask, spec)` from
`e2e/support/reflection.ts`: evidence-date assertions strict, answer regexes
loose, `minRelevant` where the plan says "≥N of".

> **Fixture note:** the Memories page is retrieval-first and streams the answer.
> `ask()` waits for phase 1 (evidence cards `a[data-evidence-card]` or an error),
> then phase 2 (the **Stop** button going away), then reads `[data-answer]`
> (a `<p>` while streaming, a rich `<div>` once the answer settles into
> editor-native formatting).

## Calibration (plan §0 — "calibrated to the current implementation")

Several plan phrasings retrieve date-name retrospectives (#43/#50/#51/#55/#58)
instead of the original dated entries, because retrieval is date-blind and the
diversity reranker caps evidence at 6 entries. The implemented queries were
re-worded against live `retrieve()` output. Notable changes and calibrated-down
assertions:

| ID | Change |
|----|--------|
| A6 | "Wie viel Rücklage hatte ich Anfang 2025?" (plan's "finanzieller Puffer" ranks #58 top) |
| F3 | "über eine große Auslandsreise" — surfaces the Mexico entry; 2022-07-23 never ranks |
| F4 | "Every entry about working on my novel." → reliably 3 of the 4 novel dates (2023-11-30 never surfaces) |
| F5 | "einen ruhigen Tag auf dem Balkon" — plan's generic "ruhiger, zufriedener Tag" ranks #59/#31 top |
| B1 | asserts only #36 (2024-10-20) + running/novel-motivation distractors absent; the other two work-motivation dates don't co-occur |
| B5 | expected set widened to the real happiness cluster incl. 2024-06-15 / 2026-08-04 |
| V1 / X15 | "Wie war das Jahr, in dem ich im Büro ausgebrannt bin und die Beziehung darunter litt?" → ≥3 chips in 2023 |
| V2 | "Wie war 2025 für mich?" → ≥3 chips in 2025 |
| C1 | phrased as the concrete situation (neuer Chef / Deadlines / Burnout / Kündigen) → ≥3 of the 2023 cluster |
| C2 | calibrated **down to ≥2** of {01-07, 01-19, 10-01} — the tiny "erste Spanischstunde" entry rarely survives the rerank |
| C4 | relaxed to ≥1 evidence date in 2022 **and** ≥1 in 2025 (plan wanted ≥2 each; unreachable with a 6-entry cap) |
| C5 | phrased as (Rücklage / neue Kunden / war es klug) → ≥3 of the 2025 freelance cluster |
| D2 | "vom sicheren Bürojob bis heute" → all of {2022-02-15, 2024-09-16, 2026-02-15} |
| D3 | leading phrasing so the 2023 burnout entry co-occurs with the 2025 joy entries |
| E6 | Spanish phrasing naming "dejar la oficina / autónomo / mejor decisión" → #37 top |
| X4 | "get out of the office and away from my boss" → #33 top (plan's "quit my job" ranks #35/#21 first) |
| X7 | "Neujahrs-Check-in Anfang 2026" → #52 top |

`difficult` tier == plan "known-difficult" (B7, C3, C4, D1, D4, F1, F3, X12):
recorded in the transcript, never a merge gate.

## Done

**Level-2 (vitest integration).** `test/integration/multilingual-retrieval.test.ts`
now embeds `e2e/fixtures/corpus.ts` (the same 60-entry corpus the Playwright
suite seeds) — the vector-level proof and the E2E proof share content (plan §9
Level 2). The obsolete `test/fixtures/multilingual-corpus.ts` (20 entries) was
removed. Separate suite: `npm run test:integration`, real Ollama + bge-m3, no DB.

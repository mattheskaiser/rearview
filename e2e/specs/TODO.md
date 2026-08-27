# E2E retrieval specs — deferred assertions

This session built the harness (corpus, seed, fixtures, grading model) and the
**Must-pass** retrieval + UI specs. The queries below are specified in
`docs/testing/retrieval-e2e-plan.md` §6 and §11 but **not yet implemented**. The
next session writes them using the same pattern as the finished specs:
`runReflection(ask, spec)` from `e2e/support/reflection.ts`, one `ReflectionSpec`
per matrix row, evidence-date assertions strict, answer regexes loose.

> **Note (Memories streaming rework):** the Memories page is now retrieval-first
> and streams the answer. The `ask()` fixture waits for phase 1 (evidence cards
> `a[data-evidence-card]` or an error), then phase 2 (the **Stop** button going
> away = answer done/stopped/errored), then reads `p[data-answer]`. `AskOutcome`
> is unchanged, so the specs below still just call `runReflection(ask, spec)`.

Grading fields per row come straight from the plan: `Exp+` → `expectRelevantDates`
(+ `minRelevant` when the plan says "≥N of"), `Exp−` → `expectAbsentDates`,
`Multi` → `expectMultiEntry`, `Unc` → `expectUncertainty`, "top" → `expectTopDate`.

## `retrieval-factual.spec.ts` (Category A + F)

| ID | Query | Tier | Notes |
|----|-------|------|-------|
| A3 | „Was habe ich über den Umzug geschrieben?" | Should | 2023-05-06 top; not move-abroad / golden-cage |
| A6 | „Wie hoch war mein finanzieller Puffer Anfang 2025?" | Should | answer ≈ €8,400 / ~5 months (hard) |
| F1 | "When did I *first* mention wanting to change careers?" | Should | 2023-10-21 earliest; later entries not "first" (known-difficult) |
| F2 | „Zeig mir alle Einträge, in denen ich mich ausgebrannt gefühlt habe." | Should | {2023-06-18, 2023-09-05}; exam + 2024-08-14 absent |
| F3 | „Wann habe ich über den Wunsch geschrieben, wegzuziehen / auszuwandern?" | Should | 2026-05-03 &/or 2022-07-23; 2023-05-06 not top |
| F4 | "Every time I wrote about the novel." | Must | ≥3 of {2022-09-03, 2023-11-30, 2025-06-07, 2026-03-08}; 2024-04-01 absent |
| F5 | „Wann habe ich zum ersten Mal einen ruhigen, zufriedenen Tag beschrieben?" | Should | 2024-05-04 top; 2022-05-09 not top |

## `retrieval-semantic.spec.ts` (Category B + vague V) — NEW FILE

| ID | Query | Tier | Notes |
|----|-------|------|-------|
| B1 | „Wann hatte ich mit der Motivation bei der Arbeit zu kämpfen?" | Should | ≥2 of {2024-10-20, 2024-08-14, 2024-04-01}; running/novel not top |
| B2 | "When did I feel uncertain about my career?" | Must | ≥2 of {2023-10-21, 2024-02-14, 2025-03-09} |
| B3 | „Welche Zeiten waren besonders stressig?" | Must | ≥2 of 2023 stress cluster; exam not top |
| B4 | "When did I feel burned out?" | Should | 2023-06-18 + 1 more; exam absent |
| B5 | „Wann ging es mir richtig gut?" | Should | ≥2 of {2024-05-04, 2025-11-23, 2026-08-25} |
| B6 | "When was my relationship strained?" | Should | {2023-06-18, 2023-11-14} |
| B7 | „Wann habe ich versucht, wieder Sinn in meiner Arbeit zu finden?" | Should | ≥2 of {2024-10-20, 2024-04-01, 2023-10-21} |
| V1 | „Was war 2023 los mit mir?" | Should | ≥3 evidence chips, all 2023 |
| V2 | "Tell me about my year 2025." | Should | ≥3 chips, all 2025 |

## `retrieval-synthesis.spec.ts` (Category C + D) — NEW FILE

| ID | Query | Tier | Notes |
|----|-------|------|-------|
| C1 | „Was hat mich 2023 am meisten beschäftigt?" | Must | ≥3 of the 2023 cluster; 3 themes |
| C2 | "What were my main goals in 2024?" | Must | ≥3 of {2024-01-07, 2024-01-19, 2024-10-01} |
| C3 | „Welche Themen tauchen immer wieder in meinem Tagebuch auf?" | Should | ≥4 distinct entries across ≥3 years; breadth caveat (known-difficult) |
| C4 | "What was occupying my mind in 2022 versus 2025?" | Should | ≥2 in 2022 **and** ≥2 in 2025 (known-difficult) |
| C5 | „Wie war mein erstes Jahr als Selbstständiger?" | Must | ≥3 of {2025-01-06, 2025-02-11, 2025-03-09, 2025-09-14} |
| D1 | „Wie haben sich meine Ziele von 2022 bis 2026 verändert?" | Should | ≥3 of {2022-01-08, 2024-01-07, 2025-01-06, 2026-01-20}; caveat (known-difficult) |
| D2 | "How did my attitude toward work change?" | Must | {2022-02-15, 2024-09-16, 2026-02-15} |
| D3 | „War ich 2025 glücklicher als 2023?" | Must | ≥1 of 2025 joy **and** ≥1 of 2023 stress; "yes, happier" |
| D4 | "Was I getting more motivated over time?" | Should | ≥2 across ≥2 years; "not linear" caveat (known-difficult) |
| D5 | „Wie hat sich mein Spanisch entwickelt?" | Must | ≥3 of {2022-07-23, 2024-01-19, 2025-04-02, 2026-06-21} |

## `retrieval-crosslang.spec.ts` (remaining Category E + mixed X5–X7)

| ID | Query | Tier | Notes |
|----|-------|------|-------|
| E4 | „Wann habe ich mich optimistischer wegen der Arbeit gefühlt?" | Should | 2026-02-15 (es) in evidence |
| E6 | „¿Cuándo sentí que cambiar de carrera fue la decisión correcta?" | Should | 2024-11-08 (en) in evidence |
| E7 | „Notiz über Motivation und das Weitermachen, wenn es schwer ist" | Should | 2024-12-01 (mixed) in evidence |
| E8 | „¿Cuándo hablé solo en español con un amigo?" | Should | 2025-07-10 (mixed) in evidence |
| X5 | „Wann habe ich mir vorgenommen, trotz Schwierigkeiten weiterzumachen?" | Should | 2024-12-01 in evidence |
| X6 | "When did I have a full conversation in Spanish?" | Should | 2025-07-10 in evidence |
| X7 | „Was waren meine Vorsätze für 2026?" | Should | 2026-01-20 in evidence |

## `retrieval-negative.spec.ts` (remaining N)

| ID | Query | Tier | Notes |
|----|-------|------|-------|
| N1 | „Was habe ich über meine Kinder geschrieben?" | Should | answer admits none; no fabrication (generation grounding) |
| N2 | "What was my dog's name?" | Should | admits none |
| N3 | „Wie viel wiege ich?" / "What's my weight?" | Should | admits the journal doesn't record it |
| N5 | "What are my plans for 2027?" | Should | cautious; no fabricated itinerary |
| N7 | „Was habe ich über meinen Halbmarathon-Lauf geschrieben?" | Nice | trained but never raced; no invented race day |

## `retrieval-adversarial.spec.ts` (remaining X)

| ID | Query | Tier | Notes |
|----|-------|------|-------|
| X1 | „Wann hatte ich einen unproduktiven, müden Tag?" | Should | 2025-11-02 (very short entry) in evidence |
| X4 | "When did I really want to quit my job?" | Should | 2024-08-14 (typo entry) in evidence |
| X9 | "How many months of runway did I have?" | Should | 2025-02-11 in evidence; answer has "5"/"five" + "€8,400"/"1,700" |
| X11 | „Wann bin ich in alte Arbeitsmuster zurückgefallen?" | Nice | 2025-10-05 ≤2 chunks (diversity cap) |
| X12 | "Did I think going freelance was the right call?" | Should | both 2024-11-08 and 2025-03-09 in evidence (known-difficult) |
| X13 | "When did I feel emotionally flat and going through the motions?" | Should | 2023-09-05 (indirect expression) in evidence |
| X14 | "running on empty / exhausted by my job" | Should | ≥1 of {2023-06-18, 2023-09-05} |
| X15 | „Was war 2023 los mit mir?" | Should | ≥3 evidence chips, all 2023 |
| X16 | "When did I burn out?" | Nice | #17 top, not a cooking line (needs the optional "burned the pasta" entry) |
| X17 | „Wie viele Jahre lerne ich schon Spanisch?" | Nice | answer ≈ 2 years (from 2026-06-21), not confused by other year mentions |

## Level-2 (vitest integration)

`test/integration/multilingual-retrieval.test.ts` should be extended to point its
vector-level proof at this corpus' plain texts (plan §9 Level 2). Not started.

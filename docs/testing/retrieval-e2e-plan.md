# Rearview — End-to-End Retrieval Validation Plan

Status: **planning only**. No test data, no Playwright code, no app changes have been
made from this document. The next session implements the seed corpus and Playwright
fixtures from here.

Read `CLAUDE.md` first. This plan is bound by it: Ollama is the only provider, journal
content never leaves the machine, retrieval is its own capability, the journal is the
source of truth.

---

## 0. How the system actually works (verified against the code)

Every expectation below is calibrated to the current implementation. Key facts:

| Area | Fact | Source |
| --- | --- | --- |
| Entry identity | **One entry per `(userId, journalDate)`** — unique constraint. Re-saving a date is an update, never a second row. | `prisma/schema.prisma:56` |
| Journal date | Stored explicitly as `DATE` at midnight UTC. Distinct from `createdAt`. Future dates rejected by validation. | `lib/validation/journal.ts:15`, `lib/time/journal-date.ts` |
| Rich text | Tiptap JSON. Only paragraphs, **bold**, *italic*, bulleted lists, hard breaks. `contentText` extracted deterministically: paragraphs → lines, bullet items → `- ` prefix, joined with `\n`. | `lib/editor/editor-extensions.ts`, `lib/editor/extract-text.ts` |
| Chunking | Pure, deterministic. Splits `contentText` on `\n+` (so **every line is a "paragraph"**), greedily packs to `TARGET_CHUNK_CHARS = 1000`. Entries under ~1000 chars → **1 chunk**. Overlap prefix of ≤150 chars on chunks after the first. Paragraph > 1400 chars → sentence split. | `lib/ai/chunking.ts` |
| Embeddings | `bge-m3`, **1024 dims**, via Ollama `/api/embed`. One vector per chunk. Generated **after the HTTP response is sent** (`after()` in the server action) — there is **no UI signal** when embedding finishes. Failure leaves the entry intact and chunks unembedded for a later retry. | `app/(app)/entries/actions.ts:31`, `lib/ai/entry-embeddings.service.ts` |
| Invalidation | Hash-driven. `EntryChunk.sourceHash` vs `JournalEntry.contentHash`. Edit → old chunks deleted, regenerated, re-embedded. | `lib/ai/entry-embeddings.service.ts:49` |
| Retrieval | `retrieve(userId, question)`: embed question → `searchChunksByEmbedding` returns `limit * 4 = 24` nearest by **cosine distance** (`<=>`, HNSW index) scoped to the user → `rerankForDiversity` trims to **6** with **max 2 chunks per entry** (best chunk of each distinct entry first, then backfill). | `lib/retrieval.service.ts` |
| **No similarity floor** | `askJournal` returns the "no entries related" message **only when `chunks.length === 0`** — i.e. only when the user has zero embedded chunks (or a date filter empties the set). Otherwise the LLM always receives up to 6 excerpts, however weak. | `lib/memory.service.ts:61` |
| Date filtering | `retrieve()` supports a `dateRange`, **but the Memories UI never passes one.** Retrieval is effectively date-blind; temporal questions rely on the model reading the dated excerpt headers. | `lib/retrieval.service.ts:44`, `lib/memory.service.ts:60` |
| Generation | `llama3.1` via `/api/generate`. Non-streaming `generate()` keeps a 60 s cap; the Memories flow uses **`streamAnswer()` (stream: true), no total timeout** — only a 60 s *stall* watchdog (no token for 60 s → "AI unavailable"). `temperature: 0.2`, **no seed** → output varies run to run. | `lib/ai/answer.service.ts`, `lib/ai/ollama-stream.service.ts`, `lib/ai/answer-prompt.ts` |
| Answer delivery to client | **NDJSON stream** from `POST /api/reflection`: one `{type:"evidence",evidence:[{date,label,preview}]}` frame (~1 s), then `{type:"token",value}` frames, then `{type:"done"}` / `{type:"error",error}`. `preview` = matched chunk excerpt, first ~150 chars (the user's own words). Embeddings and full chunk sets never reach the client. Retrieval-only re-fetches ("Show more entries") go through the `retrieveEvidenceAction` server action. | `app/api/reflection/route.ts`, `lib/reflection.service.ts`, `lib/types/memory.ts` |
| Memories UI DOM | `<textarea placeholder="Ask your journal a question…">`, submit button `Ask`. Evidence renders **first**, under **"From your journal"**, as cards `<a data-evidence-card href="/entries?date=YYYY-MM-DD">` (date label + preview) with a **"Show more entries"** button. The answer streams into `<p data-answer>` in a panel with an `AI-generated` badge, a **Stop** button while streaming, then **Regenerate** / **Save as Memory**. | `app/components/organisms/ReflectionPanel.organism.tsx`, `AnswerPanel.organism.tsx`, `EvidenceCards.organism.tsx`, `EvidenceCard.molecule.tsx` |
| Memory persistence | `Save as Memory` resolves the cited dates → entry ids at save time and writes a `Memory` + `MemoryEntry[]`. Snapshot, not a live view. | `lib/memory.service.ts:94` |
| Auth | Better Auth email/password. Registration allowed only while `userCount === 0` **or** `AUTH_ALLOW_REGISTRATION=true`. First account adopts all ownerless rows. Session cookie prefix `rearview`. Password: ≥8 chars, ≥1 letter, ≥1 number. | `lib/auth/registration.ts`, `lib/validation/auth.ts` |
| Question validation | Trimmed, 1–500 chars. | `lib/validation/memory.ts:14` |
| Activity map | Overview page. `entryDates` straight from DB (`listEntryDates`). Cells: `<a href="/entries?date=…" title="Month D, YYYY\nJournal entry">` when filled, `bg-muted` when empty past, dashed when future. Year list + ranges derived from data. | `app/components/organisms/ActivityMap.organism.tsx`, `ActivityCell.molecule.tsx` |
| Existing tests | Unit (`vitest`, Ollama + DB mocked). Integration (`npm run test:integration`, real Ollama) with `test/fixtures/multilingual-corpus.ts` (20 entries, 6 themes × 3 langs + 1 mixed + 1 long) proving the **embedding space is language-agnostic at the vector level**. **No Playwright, no `e2e/`, no `playwright.config`.** | `vitest.integration.config.mts`, `test/integration/multilingual-retrieval.test.ts` |

### Consequences for test design

1. **Retrieval assertions are the backbone.** "Is the right journal date in the evidence
   chips?" is far more stable than any assertion on generated prose. Weight the suite
   toward retrieval.
2. **"No relevant entry" cannot be produced by retrieval.** With a seeded corpus every
   question returns 6 excerpts. Negative tests therefore evaluate **generation grounding**
   ("did the model correctly say it doesn't know?"), which is the weakest, most variable
   link — treat these as *Should pass* / *Known difficult*, not *Must pass*. The only
   route to the true empty-evidence path is querying **before seeding** or with a
   date-filtered corpus (not reachable from the UI).
3. **Temporal precision is limited.** Retrieval ignores dates; the diversity reranker
   caps evidence at 6 entries / 2 chunks per entry. "How did my goals change from 2022 to
   2026" can physically cite at most 6 dates. Expected answers must be scoped to "names
   the main threads visible in ≤6 excerpts", never "exhaustive timeline".
4. **Generation is non-deterministic.** Assert on answer content with
   presence/absence keyword rules, never equality. Persist every Q/A pair to a JSON
   artifact for human review.
5. **Cross-language retrieval is expected to be strong** (bge-m3, already proven at the
   vector level) — those assertions can be *Must pass*.

---

## 1. Complete test dataset design

A single synthetic journal for one test account, **60 entries**, spanning
2022‑01‑08 → 2026‑08‑25 (all ≤ the fixed "today" of 2026‑08‑27). It reads as one
person's evolving life, not a benchmark list. Ten narrative **threads** run through it;
fifteen **themes** recur and deliberately overlap; several entries **contradict** earlier
ones or express a concept **indirectly**.

Design rules:

- One entry per calendar date (hard constraint). Dates cluster where the narrative
  justifies it (burnout in spring 2023) and thin out where life was quiet.
- Length mix: ~18 **short** (< 300 chars, 1 chunk), ~30 **medium** (300–900 chars,
  1 chunk), ~12 **long** (1,200–3,600 chars, 2–4 chunks).
- Language mix: German majority, then English, then Spanish, with 5 genuinely
  mixed-language entries. Spanish entries cluster in 2025–2026 **because** a thread has
  the writer learning Spanish — the distribution is itself a narrative signal.
- Cross-language links are **conceptual, never translations**. The German burnout entry
  and the English "career uncertainty" entry share no vocabulary.
- Distractors are built in: exam-stress vs work-stress, apartment-move vs move-abroad vs
  emotionally-moved, "burned out" vs "burned the dinner", motivation attached to five
  different activities.

### The 60-entry corpus specification

`L` = length class (S/M/L). `Lang` primary language (mix = contains ≥2). "Intent" is the
semantic content the next session writes into a realistic entry — **not** the literal
text.

| # | Date | Lang | L | Threads | Themes | Intent (write a realistic entry conveying this) | Flags |
|---|---|---|---|---|---|---|---|
| 1 | 2022-01-08 | de | S | A,G | goal, money, exercise | New-year goals: run a half marathon this year, save more money. | |
| 2 | 2022-02-15 | de | M | B,H | work, routine, relationship | Content in the office job — likes the structure, values the security. | contradiction-anchor (vs #34) |
| 3 | 2022-03-20 | de | M | A | exercise, motivation, goal | Half-marathon training going well, first 10 km done, feeling driven. | |
| 4 | 2022-04-11 | en | S | exam | stress, learning | A certification exam in three weeks; anxious about it. | distractor for work-stress |
| 5 | 2022-05-09 | de | M | F | learning, routine, exercise | Passed the exam; relief; the morning walk keeps the head clear. | morning-walk habit established |
| 6 | 2022-06-11 | de | M | H | relationship | Long phone call with sister Anna; family and close friends are an anchor. | |
| 7 | 2022-07-23 | es | S | D | relationship, dream, learning | Talk with Tomás; would love to actually speak Spanish one day. | someday / Spanish seed |
| 8 | 2022-09-03 | de | L | B,E | work, career, dream, creative | Summer retrospective: job is safe but something's missing; a someday dream of an own project, maybe writing a novel — **stated in the last paragraph**. | info-at-end |
| 9 | 2022-10-17 | de | M | A | motivation, exercise | Motivation for running is fading; the half marathon appeals less. | thread-A waning |
| 10 | 2022-12-28 | en | M | — | goal, work, money | Year in review: proud of the exam, ambivalent about work, savings still thin. | |
| 11 | 2023-01-05 | de | S | A | goal | Resolutions: this year the half marathon *for real*. | doomed recommit |
| 12 | 2023-02-02 | de | M | C | work, stress | New manager, more deadlines, sleeping badly. | thread-C rising |
| 13 | 2023-03-09 | de | M | C | stress, work | The pressure at the office is crushing; thin-skinned, no let-up. | |
| 14 | 2023-03-27 | de | S | A | goal, motivation | "I don't care about the half marathon any more. Full stop." | **abandonment (explicit)** |
| 15 | 2023-04-18 | en | M | C | stress, work | Workload this quarter is crushing, no room to breathe, goes to bed tense. | |
| 16 | 2023-05-06 | de | M | — | routine, money | Moving into a new flat; boxes everywhere; expensive. | "moving" literal distractor |
| 17 | 2023-06-18 | de | L | C,H | stress, work, relationship | ~3,500 chars, 5 paragraphs about a punishing stretch; strain with Lena; the admission **"I think I'm burned out" lands in the final paragraph**. | info-at-end, multi-chunk, first "burned out" |
| 18 | 2023-07-30 | es+de | S | H | stress, relationship | Hard week; Tomás listened. (Spanish with a German sentence.) | mixed es+de |
| 19 | 2023-09-05 | de | M | C | stress | Burnout expressed **without the word**: "I just function now. Coffee, meetings, couch, repeat." | indirect expression |
| 20 | 2023-10-02 | de | M | C | growth, motivation | Learned to say no and defend breaks; used to overwork for everyone else. | recovery begins |
| 21 | 2023-10-21 | en | M | B | career | First time writing it down: "I think I want to change careers." | **Category F target: first mention** |
| 22 | 2023-11-14 | de | M | H | relationship | A repair conversation with Lena; honest about the last six months. | |
| 23 | 2023-11-30 | de | M | E | creative | The novel idea is on ice; no energy for anything creative. | habit disappears |
| 24 | 2023-12-20 | de | M | C | growth, stress | Year-end: a hard year, but I started paying attention to myself. | |
| 25 | 2024-01-07 | de | M | B,D,E,J | goal, career, learning, creative, travel | **Bulleted** 2024 goal list: leave the office job / learn Spanish / write again / take one real trip. | bullet list |
| 26 | 2024-01-19 | de | S | D | learning | First Spanish lesson today. | **Category A target: "when did I start"** |
| 27 | 2024-02-14 | en+de | M | B,G | career, money | Career uncertainty: could freelance, could stay; scared of the income gap. (English with a German phrase.) | mixed en+de |
| 28 | 2024-03-08 | de | M | C | stress | A short stress spike — but this time it passed faster. | thread-C shortening |
| 29 | 2024-04-01 | en | L | — | routine, work, motivation | An ordinary Monday, 4 paragraphs: inbox, a pointless review meeting, one clear 90-minute stretch on my own project, cooking in the evening; the pace felt sustainable. | multi-chunk (adapt from existing fixture) |
| 30 | 2024-05-04 | de | M | — | happiness | A light, contented day on the balcony with a book. | |
| 31 | 2024-06-15 | en | S | — | happiness | A calm, contented day. Coffee in the sun, a good novel. | |
| 32 | 2024-07-12 | es | M | J,D | travel, relationship | Two weeks in Spain with no work email, time with Tomás. | real disconnected trip |
| 33 | 2024-08-14 | de | S | B,C | stress, work, career | Lowercase, typo-ridden, slangy: "ugh total stress at the office again, can't any more, boss is a pain, just want out of here". | **typos / informal / slang** |
| 34 | 2024-09-16 | de | M | B | career, work | "The security of the office job was a golden cage." | **contradiction vs #2** |
| 35 | 2024-10-01 | de | M | B,G | career, money | "On 15 September I quit." The third most important day of the year. | **in-text date ≠ journalDate; numbers** |
| 36 | 2024-10-20 | de | M | — | motivation | The drive is gone; trying to feel *why* I started. | motivation dip |
| 37 | 2024-11-08 | en | M | B | career, motivation | "Going freelance was the best decision I ever made." | contradiction-anchor (vs #41) |
| 38 | 2024-12-01 | de+en | S | E | motivation, creative | "Quick note: started again today. I want to keep going even when it's hard." | **mixed de+en** |
| 39 | 2025-01-06 | de | M | I,E,J | goal, dream, creative, travel | New goal for 2025: stable freelance income + one big trip a year + writing every morning. | **new goal introduced 2025** |
| 40 | 2025-02-11 | de | M | G,B | money, career | "Runway: €8,400, ~5 months at €1,700/mo, need 2 new clients." | **specific figures** |
| 41 | 2025-03-09 | de | M | B | career | "Sometimes I wonder whether a permanent job would have been the smarter choice." | ambivalence, **contradiction vs #37** |
| 42 | 2025-04-02 | es | M | D | learning | "I write almost the whole diary in Spanish now. Real progress." | thread-D consistent |
| 43 | 2025-05-18 | en | M | A | goal, growth | Retrospective: glad I let the half-marathon goal go — it was never mine. | **thread-A closure / Category F** |
| 44 | 2025-06-07 | de | M | E | creative, routine | 500 words most mornings on the novel. | **habit returns** |
| 45 | 2025-07-10 | de+es | S | D,H | learning, relationship | "Only Spanish with Tomás today. *Me sentí más seguro.* Small step." | **mixed de+es** |
| 46 | 2025-08-22 | es | M | J | travel | Portugal: a week walking the coast, no work. | |
| 47 | 2025-09-14 | de | M | G,B | money, career | Two new clients; the income finally holds. | thread-G resolves |
| 48 | 2025-10-05 | de | M | C | stress | A relapse: one week of overworking, old patterns. | the single thread-C blip |
| 49 | 2025-11-02 | de | S(very) | — | routine | "Tired. Got little done. More tomorrow." | **very short entry** |
| 50 | 2025-11-23 | en | M | — | happiness | Happier this year than in a long time — compared to 2023 it's night and day. | **temporal-comparison target** |
| 51 | 2025-12-19 | de | M | — | happiness, growth, career | Year in review 2025: the first year that felt like my life. | |
| 52 | 2026-01-20 | en+es | S | I | goal | "New year check-in. *Mis objetivos siguen siendo los mismos:* freelance stable, one big trip, write most mornings." | **mixed en+es**; thread-I still active |
| 53 | 2026-02-15 | es | M | B,G | career, money, happiness | "More optimistic about work than ever. The money fear has almost gone." | **Category E: ES evidence for a work question** |
| 54 | 2026-03-08 | de | M | E | creative, routine | Morning writing is a habit now, no effort. | |
| 55 | 2026-04-12 | de | M | H,C | relationship, stress | Anna visits; we talk about how stressed I was in 2023. | |
| 56 | 2026-05-03 | de | M | J,D,I | travel, learning, goal | Planning the big trip: Mexico this year — Spanish finally put to use. | |
| 57 | 2026-06-21 | es | M | D | learning | "Two years learning Spanish. From one sentence to a whole diary." | **temporal: "how did Spanish progress"** |
| 58 | 2026-07-15 | de | L | I,B,E,J | goal, career, creative, travel, growth | Mid-2026 review, multi-paragraph: goals mostly on track — income stable, novel going, trip booked; reflects on the road since 2022. | multi-chunk synthesis anchor |
| 59 | 2026-08-04 | de | S | — | happiness | A quiet, good day. Grateful. | |
| 60 | 2026-08-25 | de | M | — | happiness, growth | Almost September. Nothing to complain about right now — unfamiliar and good. | |

Realized distribution after writing (target; the table is the source of truth): **≈ 38 DE
/ 13 EN / 9 ES**, of which **5 are mixed-language** (#18, 27, 38, 45, 52).

### Sample entries (tone lock — the next session writes the rest to match)

> **#14 — 2023-03-27 (de, S)**
> Der Halbmarathon ist mir egal geworden. Ganz ehrlich. Ich habe die Anmeldung offen
> gelassen und einfach zugemacht. Kein schlechtes Gewissen.

> **#21 — 2023-10-21 (en, M)**
> I wrote it in a message to myself and then just looked at it for a while: I think I
> want to change careers. Not a bad day at work, not a dramatic one. It's more that I
> can see the next ten years from here and none of it makes me want to get up early.

> **#19 — 2023-09-05 (de, M)**
> Ich funktioniere nur noch. Kaffee, Meetings, Couch, wiederholen. Am Wochenende bin ich
> zu müde für die Dinge, die ich angeblich gern mache. Es ist nicht dramatisch, es ist
> nur grau. Nichts fühlt sich gerade nach mir an.

> **#33 — 2024-08-14 (de, S — leave the typos in)**
> boah heute wieder totaler stress im buero, kann nlnicht mehr echt. chef will die
> auswertung bis morgen und keinen interessierts dass ich seit wochen durchziehe. will
> einfach nur weg hier

> **#45 — 2025-07-10 (de+es, S)**
> Heute nur auf Spanisch mit Tomás geredet, fast eine Stunde. Me sentí más seguro de lo
> que esperaba. Noch viele Fehler, aber es fließt langsam. Kleiner Fortschritt.

> **#35 — 2024-10-01 (de, M — in-text date differs from the journal date)**
> Am 15. September habe ich gekündigt. Zwei Wochen ist das jetzt her und ich schreibe es
> zum ersten Mal richtig auf. Rückblickend der drittwichtigste Tag des Jahres, nach
> Lenas Geburtstag und dem Tag in Spanien, an dem ich zum ersten Mal gemerkt habe, dass
> es auch anders geht.

---

## 2. Entry distribution by year

| Year | Entries | Narrative weight | Date span |
|---|---|---|---|
| 2022 | 10 | Baseline: office contentment, the running goal, the exam, the someday-dream. Threads A, B, D, E, F, G, H seeded. | Jan 08 – Dec 28 |
| 2023 | 14 | The hard year. Burnout arc peaks (Feb–Jun), running goal abandoned (Mar), first "change careers" (Oct), growth + relationship repair begin (Oct–Nov). | Jan 05 – Dec 20 |
| 2024 | 14 | The pivot. Spanish starts (Jan), bulleted goals, career uncertainty → quitting (Oct), real trip to Spain, motivation dip then recovery. | Jan 07 – Dec 01 |
| 2025 | 13 | The rebuild. New 2025 goal, runway math, ambivalence about freelancing, novel habit returns, income stabilises, one stress relapse, "happier than 2023". | Jan 06 – Dec 19 |
| 2026 | 9 | Settled. Goals on track, Spanish in real use, Mexico trip planned, gratitude. Ends before "today" (2026-08-27). | Jan 20 – Aug 25 |
| **Total** | **60** | | 2022-01-08 – 2026-08-25 |

Rationale: 2023–2024 carry the most change, so they get the most entries; 2026 is
partial (only ~8 months elapsed) and calm, so it's lightest. This shape also exercises
the activity map across five year tabs with visibly different densities.

---

## 3. Language distribution

| Language | Entries | Share | Where it clusters | Why |
|---|---|---|---|---|
| German (de) | ~38 | ~63% | Everywhere; the writer's native language. | Requirement: German majority. |
| English (en) | ~13 | ~22% | Career reflection (#21, #27, #37, #43, #50), the "ordinary Monday" (#29), year reviews. | The writer drops into English for work/career thinking. |
| Spanish (es) | ~9 | ~15% | 2022 seed (#7), then 2024→2026 growing (#32, #42, #46, #53, #57). | A thread has the writer learning Spanish; the distribution *is* the evidence. |
| Mixed (≥2 langs in one entry) | 5 | — | #18 (es+de), #27 (en+de), #38 (de+en), #45 (de+es), #52 (en+es) | Adversarial: code-switching is realistic and stresses the embedder. |

All three pairwise mixes are covered: de+en, de+es, en+es.

Cross-language *conceptual* pairs (no shared vocabulary), used by Category E:

| Concept | German | English | Spanish |
|---|---|---|---|
| Work motivation / career doubt | #33 (slang "will einfach weg"), #34 ("goldener Käfig") | #21 ("change careers"), #27 ("career uncertainty") | #53 ("más optimista sobre el trabajo") |
| Burnout / overwhelm | #13, #17, #19 (indirect) | #15 ("crushing"), #29 (contrast: sustainable) | #18 ("semana dura") |
| Contentment | #30, #59, #60 | #31, #50 | (none — deliberate gap; a Spanish "happiness" query must cross to DE/EN) |
| Learning Spanish progress | #26 (start), #45, #56 | — | #42, #57 (two years on) |
| Relationships / support | #6, #22, #55 | (none pure) | #7, #32 |
| Half-marathon goal | #1, #3, #9, #11, #14 | #43 (let it go) | (none) |

---

## 4. Theme distribution

Fifteen themes, each appearing in ≥3 entries across ≥2 years, deliberately overlapping so
no single keyword solves a query.

| Theme | Entry numbers | Years | Overlaps with |
|---|---|---|---|
| Goals (concrete targets) | 1, 10, 11, 25, 39, 43, 52, 56, 58 | 22–26 | motivation, career, learning, travel, creative |
| Motivation / drive | 3, 9, 20, 29, 36, 37, 38, 43 | 22–25 | **work, exercise, learning, creative, career** (5-way overlap — by design) |
| Work / office life | 2, 8, 10, 12, 13, 15, 17, 29, 33, 34 | 22–24 | stress, career, routine, motivation |
| Career direction / change | 8, 21, 27, 33, 34, 35, 37, 41, 47, 53, 58 | 22–26 | work, money, motivation, growth |
| Money / finances | 1, 10, 16, 27, 35, 40, 47, 53 | 22–26 | career, stress, travel |
| Relationships (partner/family/friends) | 2, 6, 17, 18, 22, 32, 45, 55 | 22–26 | stress, growth, travel, learning |
| Daily routine / rhythm | 2, 5, 16, 29, 44, 49, 54 | 22–26 | work, creative, exercise |
| Personal growth / boundaries | 20, 24, 43, 51, 58, 60 | 23–26 | stress, career, relationships |
| Stress / overwhelm / burnout | 4, 12, 13, 15, 17, 18, 19, 24, 28, 33, 48, 55 | 22–26 | work, career, exam(distractor), relationships |
| Happiness / contentment | 30, 31, 50, 51, 59, 60 | 24–26 | growth, routine |
| Travel | 25, 32, 39, 46, 52, 56, 58 | 24–26 | learning (Spanish), relationships, goals |
| Learning (Spanish, the exam, reading) | 4, 5, 7, 25, 26, 42, 45, 56, 57 | 22–26 | motivation, relationships, travel |
| Exercise / lifestyle (running, walking) | 1, 3, 5, 9, 43 | 22–25 | motivation, goals, routine — *lifestyle framing only, no medical content* |
| Creative activities (novel, writing) | 8, 23, 25, 38, 39, 44, 54, 58 | 22–26 | dream, motivation, routine |
| Long-term ambitions ("someday") | 7, 8, 39, 52, 56 | 22–26 | career, travel, creative |

**Overlap stress test:** "When was I struggling with motivation?" — the word *motivation*
appears attached to running (#9), the novel (#38), Spanish, work (#29, #36) and career
(#37). A **work-motivation** query must rank #36 / #33 / #29 above #9 / #38. This is an
explicit Category B assertion.

---

## 5. Temporal relationships (the ten threads)

| Thread | Arc | Entries (in order) | What it lets us ask |
|---|---|---|---|
| **A. Half-marathon goal** | Set 2022 → training → interest fades late 2022 → **explicitly abandoned Mar 2023** → never pursued again → 2025 retrospective "glad I let it go". | 1 → 3 → 9 → 11 → **14** → 43 | "What goal did I give up in 2023?" / "When did I stop caring about running races?" |
| **B. Career: office → own thing** | Contentment 2022 → something missing (2022) → **first "change careers" Oct 2023** → uncertainty (Feb 2024) → **quits 15 Sep 2024** → "best decision" (Nov 2024) → ambivalence (Mar 2025) → income holds (Sep 2025) → optimistic (Feb 2026, ES). | 2 → 8 → 21 → 27 → 33 → 34 → 35 → 37 → 41 → 47 → 53 → 58 | "How did my attitude to work change from 2022 to 2026?" / "When did I first mention changing careers?" |
| **C. Stress / burnout** | Rising early 2023 → **peak Feb–Jun 2023** ("burned out" #17) → learning to say no (Oct 2023) → shorter spikes 2024 → one relapse Oct 2025 → resolved 2026. | 12 → 13 → 15 → **17** → 19 → 20 → 28 → 48 → 55 | "Find every time I talked about feeling burned out." / "Was I becoming less stressed over time?" |
| **D. Learning Spanish** | Wish (2022) → **starts 19 Jan 2024** → sporadic 2024 → consistent 2025 (writes diary in ES) → fluent-ish 2026 ("two years", whole entries in ES). | 7 → **26** → 32 → 42 → 45 → 56 → 57 | "When did I start learning Spanish?" / "How did my Spanish progress?" |
| **E. The novel** | Someday-dream (2022) → **dropped 2023** (too stressed) → restarts late 2024 → habit by mid-2025 → effortless 2026. | 8 → 23 → 38 → 39 → 44 → 54 | "What creative project did I abandon and pick back up?" |
| **F. Morning walk** | Daily 2022–early 2023 → **vanishes during burnout** → never explicitly resumed. | 5 → (implicit in 2022–23) → gone | "What daily habit did I lose?" |
| **G. Money** | Anxious (2022) → tight (2023) → income fear before quitting (2024) → runway math (Feb 2025) → stabilises (Sep 2025) → fear gone (2026). | 1 → 10 → 27 → 35 → 40 → 47 → 53 | "How did my money worries change?" |
| **H. Partner (Lena) + sister (Anna)** | Steady 2022 → strained during burnout 2023 → **repair conversation Nov 2023** → strong 2024–26. Anna phone calls recur as an anchor. | 2 → 6 → 17 → 22 → 55 | "When were things hard with Lena?" |
| **I. New 2025 goal** | Introduced Jan 2025 (stable income + one big trip/year + morning writing) → still active and on track 2026. | 39 → 52 → 56 → 58 | "What goal did I set in 2025 and is it still active?" |
| **J. Travel** | None 2022–23 (money/stress) → ruined short trip implied → **real trip to Spain 2024** → Portugal 2025 → planning Mexico 2026. | 25 → 32 → 46 → 56 → 58 | "How did my relationship with travel change?" |

**Contradiction pairs** (same person, opposite statements — synthesis must surface the
*change*, not average it away):

| Earlier | Later | Tension |
|---|---|---|
| #2 (2022): loves the office job's security | #34 (2024): "a golden cage" | attitude to job security |
| #11 (Jan 2023): "this year, the half marathon for real" | #14 (Mar 2023): "I don't care any more" | abandoned goal, 11 weeks apart |
| #37 (Nov 2024): "best decision I ever made" | #41 (Mar 2025): "maybe a permanent job would have been smarter" | freelancing, unresolved ambivalence |

**Indirect expressions** (concept present, keyword absent):

- #19 — burnout, never says "burnout" / "ausgebrannt".
- #8 — the someday-dream is only in the final paragraph; the entry opens about the office.
- #33 — career-change desire expressed as "just want out of here", never "career".

---

## 6. Query catalog

All 42 queries. `Exp+` = journal dates that **must** appear in the evidence chips. `Exp−`
= distractor dates that **must not** dominate the evidence (appearing as a 5th/6th chip
is tolerated; being the top chip is a fail). `Multi` = answer should synthesise ≥2
entries. `Unc` = answer should acknowledge uncertainty / missing evidence.

### Category A — exact factual retrieval

| ID | Query (lang) | Exp+ | Exp− | Expected answer (sketch) | Multi | Unc | Diff |
|---|---|---|---|---|---|---|---|
| A1 | „Wann habe ich angefangen, Spanisch zu lernen?" (de) | 2024-01-19 | 2022-07-23, 2026-06-21 | January 2024 — the first lesson. (2022 was only a wish; 2026 is "two years in".) | no | no | easy |
| A2 | "What were my goals for 2024?" (en) | 2024-01-07 | 2025-01-06, 2022-01-08 | Leave the office job, learn Spanish, write again, take one real trip. | yes | no | easy |
| A3 | „Was habe ich über den Umzug geschrieben?" (de) | 2023-05-06 | 2025-05-03(move abroad), 2024-09-16(golden cage) | Moving into the new flat in May 2023 — boxes, costs. | no | no | med |
| A4 | „Wann habe ich gekündigt?" (de) | 2024-10-01 | 2024-10-20, 2024-11-08 | On 15 September 2024 (written up on 1 Oct). Note: entry date ≠ the quoted date. | no | no | med |
| A5 | "What did I set as my goal in 2025?" (en) | 2025-01-06 | 2024-01-07, 2026-01-20 | Stable freelance income, one big trip a year, writing every morning. | no | no | easy |
| A6 | „Wie hoch war mein finanzieller Puffer Anfang 2025?" (de) | 2025-02-11 | 2025-09-14 | About €8,400 — roughly five months at €1,700/month. | no | no | hard |
| A7 | "Which goal did I abandon in 2023?" (en) | 2023-03-27 | 2023-01-05, 2022-10-17 | The half marathon — dropped in March 2023. | no | no | med |
| A8 | „Wohin bin ich 2024 gereist?" (de) | 2024-07-12 | 2025-08-22, 2026-05-03 | To Spain, for two weeks with no work email. | no | no | easy |

### Category B — semantic retrieval (concept, not keyword)

| ID | Query (lang) | Exp+ | Exp− | Expected answer | Multi | Unc | Diff |
|---|---|---|---|---|---|---|---|
| B1 | „Wann hatte ich mit der Motivation bei der Arbeit zu kämpfen?" (de) | 2024-10-20, 2024-08-14, 2024-04-01 | 2022-10-17(running), 2024-12-01(novel) | Autumn 2024 — the drive was gone, trying to remember why; also the slangy Aug 2024 entry. | yes | no | hard |
| B2 | "When did I feel uncertain about my career?" (en) | 2023-10-21, 2024-02-14, 2025-03-09 | 2024-11-08(certain) | Oct 2023 (first admission), Feb 2024 (freelance-or-stay), March 2025 (second-guessing). | yes | no | med |
| B3 | „Welche Zeiten waren besonders stressig?" (de) | 2023-03-09, 2023-04-18, 2023-06-18 | 2022-04-11(exam), 2025-10-05(minor) | Spring–summer 2023, especially around the office deadlines; peak in June. | yes | no | med |
| B4 | "When did I feel burned out?" (en) | 2023-06-18, 2023-09-05, 2023-03-09 | 2022-04-11(exam), 2024-08-14(short spike) | Mid-2023 — explicitly in June, and Sept ("just functioning"). | yes | no | hard |
| B5 | „Wann ging es mir richtig gut?" (de) | 2024-05-04, 2025-11-23, 2026-08-25 | 2023-06-18 | Scattered calm days from mid-2024 on; 2025–2026 markedly lighter. | yes | no | med |
| B6 | "When was my relationship strained?" (en) | 2023-06-18, 2023-11-14 | 2022-06-11, 2026-04-12 | During the 2023 burnout; a repair conversation followed in November. | yes | no | hard |
| B7 | „Wann habe ich versucht, wieder Sinn in meiner Arbeit zu finden?" (de) | 2024-10-20, 2024-04-01, 2023-10-21 | 2022-02-15 | Late 2024, reconnecting with the "why"; the seed was the 2023 career doubt. | yes | no | hard |

### Category C — multi-entry synthesis

| ID | Query (lang) | Exp+ (≥3 of) | Expected answer | Multi | Unc | Diff |
|---|---|---|---|---|---|---|
| C1 | „Was hat mich 2023 am meisten beschäftigt?" (de) | 2023-02-02, 2023-03-09, 2023-06-18, 2023-10-21, 2023-10-02 | Work stress / burnout, giving up the half marathon, and the first thought of changing careers. | yes | no | med |
| C2 | "What were my main goals in 2024?" (en) | 2024-01-07, 2024-01-19, 2024-10-01 | Leaving the office job (achieved — quit in Sept), learning Spanish (started Jan), writing again, one real trip (Spain). | yes | no | med |
| C3 | „Welche Themen tauchen immer wieder in meinem Tagebuch auf?" (de) | any across ≥4 themes/years | Work & career direction, stress/recovery, motivation, relationships, and learning Spanish. | yes | yes (breadth caveat) | hard |
| C4 | "What was occupying my mind in 2022 versus 2025?" (en) | 2022: 2, 8, 1 · 2025: 39, 41, 44 | 2022: office security, a vague someday-dream, saving money, running. 2025: freelancing (with doubts), building income, the novel habit. | yes | no | hard |
| C5 | „Wie war mein erstes Jahr als Selbstständiger?" (de) | 2025-01-06, 2025-02-11, 2025-03-09, 2025-09-14 | Financially tight and anxious at first (runway math, second-guessing), stabilising by autumn with two new clients. | yes | no | med |

### Category D — temporal comparison

| ID | Query (lang) | Exp+ | Expected answer | Multi | Unc | Diff |
|---|---|---|---|---|---|---|
| D1 | „Wie haben sich meine Ziele von 2022 bis 2026 verändert?" (de) | 2022-01-08, 2024-01-07, 2025-01-06, 2026-01-20 (≥3) | From external targets (a race, saving money) to a shift away from the office job, to a self-directed life (stable freelance income, one trip a year, daily writing) — largely on track by 2026. | yes | yes (≤6 entries caveat) | hard |
| D2 | "How did my attitude toward work change?" (en) | 2022-02-15, 2024-09-16, 2026-02-15 | From valuing the security of the office job → calling it a "golden cage" and quitting → more optimistic about work than ever, on my own terms. | yes | no | med |
| D3 | „War ich 2025 glücklicher als 2023?" (de) | 2025-11-23, 2025-12-19, 2023-06-18, 2023-12-20 | Yes, clearly — 2023 was a burnout year; 2025 is described as "the first year that felt like my life", explicitly contrasted with 2023. | yes | no | med |
| D4 | "Was I getting more motivated over time?" (en) | 2023-06-18, 2024-10-20, 2025-06-07, 2026-03-08 | Not linear — a low through burnout and again in late 2024, but by 2025–2026 the drive is steadier (the writing habit sticks). | yes | yes | hard |
| D5 | „Wie hat sich mein Spanisch entwickelt?" (de) | 2022-07-23, 2024-01-19, 2025-04-02, 2026-06-21 | From wanting to speak it "one day" (2022) → first lesson Jan 2024 → writing the diary in Spanish (2025) → whole entries, "two years in" (2026). | yes | no | med |

### Category E — cross-language retrieval

| ID | Query lang → evidence lang | Query | Exp+ (evidence) | Expected answer | Diff |
|---|---|---|---|---|---|
| E1 | de → en | „Wann war ich unsicher, was meine Karriere angeht?" | 2023-10-21, 2024-02-14 (en) | Oct 2023 / Feb 2024 — first wrote about wanting to change careers, then the freelance-or-stay dilemma. | med |
| E2 | en → de | "When was I overwhelmed by work?" | 2023-03-09, 2023-06-18, 2024-08-14 (de) | Spring–summer 2023, and a slangy vent in Aug 2024. | med |
| E3 | es → de | „¿Cuándo estuve al límite por el trabajo?" | 2023-06-18, 2023-09-05, 2023-03-09 (de) | Mid-2023 — the burnout stretch. | hard |
| E4 | de → es | „Wann habe ich mich optimistischer wegen der Arbeit gefühlt?" | 2026-02-15 (es), 2025-12-19 (de) | Early 2026 — "más optimista sobre el trabajo que nunca". | hard |
| E5 | en → es | "When did I take a proper trip to disconnect?" | 2024-07-12 (es), 2025-08-22 (es) | Spain 2024 (two weeks, no email) and Portugal 2025. | med |
| E6 | es → en | „¿Cuándo sentí que cambiar de carrera fue la decisión correcta?" | 2024-11-08 (en) | November 2024 — "the best decision I ever made" (though later entries are more ambivalent). | med |
| E7 | de → mixed | „Notiz über Motivation und das Weitermachen, wenn es schwer ist" | 2024-12-01 (de+en) | The Dec 2024 note about starting again and wanting to keep going. | med |
| E8 | es → mixed | „¿Cuándo hablé solo en español con un amigo?" | 2025-07-10 (de+es) | July 2025 — an hour only in Spanish with Tomás, felt more confident. | hard |

### Category F — specific-occurrence retrieval

| ID | Query (lang) | Exp+ | Exp− | Expected answer | Multi | Diff |
|---|---|---|---|---|---|---|
| F1 | "When did I *first* mention wanting to change careers?" (en) | 2023-10-21 | 2024-02-14, 2024-09-16, 2024-10-01 | October 2023 — earlier entries only hint (2022: "something's missing"). | no | hard |
| F2 | „Zeig mir alle Einträge, in denen ich mich ausgebrannt gefühlt habe." (de) | 2023-06-18, 2023-09-05 (+ 2023-03-09) | 2022-04-11, 2024-08-14 | Two–three entries in 2023; June is the explicit one, September the indirect "just functioning" one. | yes | hard |
| F3 | „Wann habe ich über den Wunsch geschrieben, wegzuziehen / auszuwandern?" (de) | 2026-05-03 (Mexico trip), 2022-07-23 | 2023-05-06 (flat move) | Only as travel plans, not emigration — the 2023 "Umzug" is a local flat move, not this. | yes | hard |
| F4 | "Every time I wrote about the novel." (en) | 2022-09-03, 2023-11-30, 2025-06-07, 2026-03-08 (≥3) | 2024-04-01 (reading, not writing) | A someday-idea in 2022, shelved in 2023, restarted 2024–25, a daily habit by 2026. | yes | med |
| F5 | „Wann habe ich zum ersten Mal einen ruhigen, zufriedenen Tag beschrieben?" (de) | 2024-05-04 | 2022-05-09 (relief, not contentment) | May 2024 — the balcony day. | no | med |

### Category-agnostic vague queries

| ID | Query | Exp+ | Expected | Diff |
|---|---|---|---|---|
| V1 | „Was war 2023 los mit mir?" (de) | ≥3 of the 2023 stress/career cluster | A hard year: work stress and burnout, dropped the running goal, first thoughts of leaving the job. | med |
| V2 | "Tell me about my year 2025." (en) | ≥3 of 2025 | First full year freelancing — financially anxious then stabilising, novel habit forming, noticeably happier than 2023. | med |

---

## 7. Negative tests

The corpus always returns 6 excerpts (§0.2), so these assert on the **answer**, not the
evidence, and are graded on a keyword rubric (`/nicht genug|keine Einträge|keine
Hinweise|unklar|not enough|no entries|nothing (about|in)|no menciono|insufficient/i`
present; a fabricated specific claim absent).

| ID | Query | Correct outcome | Notes | Tier |
|---|---|---|---|---|
| N1 | „Was habe ich über meine Kinder geschrieben?" (de) | "Nothing — there are no entries about children." | The writer has none. Model must not invent. | Should |
| N2 | "What was my dog's name?" (en) | "No entries mention a pet / a dog." | No pets anywhere. | Should |
| N3 | „Wie viel wiege ich?" / "What's my weight?" (de/en) | "The journal doesn't record that." | CLAUDE.md: lifestyle only, no health metrics. | Should |
| N4 | „Wann war ich wegen einer Prüfung gestresst?" (de) | 2022-04-11 (exam), **not** the 2023 work entries. | Retrieval-precision negative: exam entry must be the top chip, work-stress entries must not be presented as the answer. | **Must** (evidence assertion) |
| N5 | "What are my plans for 2027?" (en) | Uncertain — only vague "someday" / "one big trip a year" content. | Model should generalise cautiously, not fabricate a 2027 itinerary. | Should |
| N6 | Any query **before the corpus is seeded** | The literal copy: *"No journal entries seem related to that question yet…"* | The **only** path to the true empty-evidence branch. | **Must** |
| N7 | „Was habe ich über meinen Halbmarathon-**Lauf** geschrieben?" (de) — a race he never ran | Should say he trained for one but abandoned it and never raced. | Presupposition failure — must not invent a race day. | Nice |

Semantically-similar-but-not-relevant pairs already in the corpus (used by N4 and the
Category-B distractor columns): exam-stress (#4) vs work-stress (#12–17); flat-move (#16)
vs move-abroad hopes; "burned out" (#17) vs the slang vent (#33) vs literal cooking is
*not* included — add a one-line "burned the pasta" entry (#59 area) only if a keyword-trap
test is wanted (see §8).

---

## 8. Adversarial tests

| ID | Stresses | Entry(s) | Query | Assertion | Tier |
|---|---|---|---|---|---|
| X1 | Very short entry retrievable | #49 (2025-11-02) | „Wann hatte ich einen unproduktiven, müden Tag?" | 2025-11-02 in evidence. | Should |
| X2 | Very long entry, key info at the **end** | #17 (2023-06-18) | "When did I admit I was burned out?" | 2023-06-18 in evidence **and** answer references June 2023. Tests chunk coverage of the last paragraph. | **Must** |
| X3 | Long entry → multi-chunk, still beats unrelated | #29 (2024-04-01) | „Wie sah ein gewöhnlicher Arbeitstag bei mir aus?" | 2024-04-01 is the top evidence chip. | **Must** |
| X4 | Typos / slang / lowercase | #33 (2024-08-14) | "When did I really want to quit my job?" (clean English) | 2024-08-14 in evidence. | Should |
| X5 | Mixed de+en in one entry | #38 (2024-12-01) | „Wann habe ich mir vorgenommen, trotz Schwierigkeiten weiterzumachen?" | 2024-12-01 in evidence. | Should |
| X6 | Mixed de+es | #45 (2025-07-10) | "When did I have a full conversation in Spanish?" | 2025-07-10 in evidence. | Should |
| X7 | Mixed en+es | #52 (2026-01-20) | „Was waren meine Vorsätze für 2026?" | 2026-01-20 in evidence. | Should |
| X8 | In-text date ≠ journal date | #35 (2024-10-01) | „An welchem Tag habe ich gekündigt?" | Answer says **15 September** (from the text), evidence chip is **2024-10-01**. Model must not report Oct 1 as the quit date. | **Must** (hard) |
| X9 | Specific number retrieval | #40 (2025-02-11) | "How many months of runway did I have?" | Answer contains "5" / "five" and "€8,400" or "1,700". | Should |
| X10 | Bulleted list embeds meaningfully | #25 (2024-01-07) | „Was stand auf meiner Zieleliste für 2024?" | ≥3 of the four list items named; 2024-01-07 top chip. | **Must** |
| X11 | Repeated idea not over-weighted | add a repetitive paragraph to #48 | „Wann bin ich in alte Arbeitsmuster zurückgefallen?" | 2025-10-05 in evidence; not more than 2 chunks from it (diversity cap). | Nice |
| X12 | Contradiction surfaced, not averaged | #37 vs #41 | "Did I think going freelance was the right call?" | Answer notes **both** the Nov 2024 conviction **and** the March 2025 doubt. | Should (hard) |
| X13 | Concept expressed indirectly | #19 (2023-09-05) | "When did I feel emotionally flat and going through the motions?" | 2023-09-05 in evidence. | Should |
| X14 | Synonym query vs journal wording | journal "ausgebrannt / kann nicht mehr"; query "running on empty / exhausted by my job" (en) | #17, #19 in evidence. | Should |
| X15 | Vague wording | V1 „Was war 2023 los mit mir?" | ≥3 evidence chips, all in 2023, answer mentions stress + the abandoned goal. | Should |
| X16 | Keyword trap | optional "burned the pasta" line | "When did I burn out?" | The cooking line is **not** the top chip; #17 is. | Nice |
| X17 | Numbers-as-dates trap | #10 ("2022"), #50 ("2023"), #57 ("two years") | „Wie viele Jahre lerne ich schon Spanisch?" | Answer: about two years (from #57), not confused by other year mentions. | Nice |

---

## 9. Cross-language tests (consolidated)

Two levels, mirroring the existing integration test:

**Level 1 — retrieval direction matrix (E2E, via the Memories UI).** For each of the 6
directions, at least one query whose *only* correct evidence is in another language:

| Direction | Test IDs | Must-pass? |
|---|---|---|
| de query → en evidence | E1, E7, X4(reverse) | Must |
| en query → de evidence | E2, X2, X13 | Must |
| es query → de evidence | E3 | Must |
| de query → es evidence | E4 | Should (only 2026 entries qualify) |
| en query → es evidence | E5 | Must |
| es query → en evidence | E6 | Should |
| any → mixed-language entry | E7, E8, X5–X7 | Should |

**Level 2 — embedding-space proof (already exists, extend it).**
`test/integration/multilingual-retrieval.test.ts` already proves cross-language nearest
neighbours on the 20-entry fixture. Extend that fixture (or point it at the new corpus'
plain texts) so the vector-level proof and the E2E proof use the same content.

**Expected answer language:** `llama3.1` tends to answer in the query's language.
Assertions should tolerate either the query language or English; do **not** assert answer
language.

---

## 10. Expected results (grading model)

For every query, the next session records a row with:

- **query**, **queryLang**
- **expectRelevantDates**: `string[]` — must ALL be present in evidence chips (unless
  marked "≥N of", then N of them)
- **expectAbsentDates**: `string[]` — must NOT be the top-1/top-2 chip
- **expectAnswerIncludes**: `RegExp[]` — all must match (case-insensitive)
- **expectAnswerExcludes**: `RegExp[]` — none may match (e.g. a fabricated name/number)
- **expectMultiEntry**: `boolean` — `evidence.length >= 2`
- **expectUncertainty**: `boolean` — answer matches the uncertainty regex
- **tier**: `must | should | nice | difficult`

Grading:

| Assertion type | How | Rigidity |
|---|---|---|
| Evidence contains expected date(s) | exact string match on chip `href` (`?date=YYYY-MM-DD`) | **strict** — this is deterministic-ish |
| Distractor not dominant | expected date's chip index < distractor's chip index | strict |
| Answer includes concept | regex / keyword presence | **loose** — synonyms allowed, phrasing free |
| Answer admits uncertainty | uncertainty regex | loose |
| Answer omits fabrication | regex absence for the specific false fact | strict (a fabricated date/number/name is a hard fail) |

Every run writes `e2e/artifacts/reflection-transcript.json` (all Q/A/evidence tuples)
and `e2e/artifacts/matrix-result.csv` for human review, regardless of pass/fail.

**Retry policy:** retrieval assertions — no retry (a miss is a real miss). Answer-content
assertions — allow **1 retry** of the whole ask (re-generation), because `llama3.1` at
temp 0.2 with no seed occasionally phrases an otherwise-correct answer in a way the regex
misses. Log both attempts.

---

## 11. Test matrix

`R` = expected relevant entries. Tier drives CI gating (§ below).

| ID | Cat | Query lang | Evidence lang | Retrieval expectation | R | Temporal? | Difficulty | Outcome | Tier |
|---|---|---|---|---|---|---|---|---|---|
| A1 | A | de | de | 2024-01-19 top | 1 | point-in-time | easy | date + answer | Must |
| A2 | A | en | de | 2024-01-07 top | 1–2 | year | easy | list ≥3 items | Must |
| A3 | A | de | de | 2023-05-06 top, not move-abroad | 1 | — | med | disambiguated | Should |
| A4 | A | de | de | 2024-10-01 top | 1 | — | med | "15 Sept" | Must |
| A5 | A | en | de | 2025-01-06 top | 1 | year | easy | 3 items | Must |
| A6 | A | de | de | 2025-02-11 top | 1 | — | hard | €8,400 / ~5 mo | Should |
| A7 | A | en | de | 2023-03-27 top | 1 | year | med | "half marathon" | Must |
| A8 | A | de | es | 2024-07-12 top | 1 | year | easy | "Spain" | Must |
| B1 | B | de | de+en | ≥2 of {2024-10-20,08-14,04-01}; running/novel not top | 2–3 | period | hard | work-motivation | Should |
| B2 | B | en | en+de | ≥2 of {2023-10-21,2024-02-14,2025-03-09} | 3 | period | med | career doubt | Must |
| B3 | B | de | de+en | ≥2 of the 2023 stress cluster; exam not top | 3 | period | med | "2023 / Frühjahr" | Must |
| B4 | B | en | de | 2023-06-18 + 1 more; exam absent | 2–3 | period | hard | "2023" | Should |
| B5 | B | de | de+en | ≥2 of {2024-05-04,2025-11-23,2026-08-25} | 2–3 | period | med | later years | Should |
| B6 | B | en | de | {2023-06-18, 2023-11-14} | 2 | period | hard | "2023 / repair" | Should |
| B7 | B | de | de+en | ≥2 of {2024-10-20,2024-04-01,2023-10-21} | 2–3 | period | hard | "late 2024" | Should |
| C1 | C | de | de+en | ≥3 of the 2023 cluster | 3–5 | year | med | 3 themes | Must |
| C2 | C | en | de | ≥3 of {2024-01-07,01-19,10-01} | 3–4 | year | med | 4 goals | Must |
| C3 | C | de | any | ≥4 distinct entries across ≥3 years | 4–6 | lifetime | hard | ≥3 themes + caveat | Should |
| C4 | C | en | de | ≥2 in 2022 **and** ≥2 in 2025 | 4 | compare | hard | contrast stated | Should |
| C5 | C | de | de | ≥3 of {2025-01-06,02-11,03-09,09-14} | 3–4 | year | med | "tight→stable" | Must |
| D1 | D | de | de | ≥3 of {2022-01-08,2024-01-07,2025-01-06,2026-01-20} | 3–4 | span | hard | trajectory + caveat | Should |
| D2 | D | en | de+es | {2022-02-15, 2024-09-16, 2026-02-15} | 3 | span | med | "cage→own terms" | Must |
| D3 | D | de | de+en | ≥1 of 2025 joy **and** ≥1 of 2023 stress | 2–4 | compare | med | "yes, happier" | Must |
| D4 | D | en | de | ≥2 across ≥2 years; non-linear | 3–4 | span | hard | "not linear" + caveat | Should |
| D5 | D | de | de+es | ≥3 of {2022-07-23,2024-01-19,2025-04-02,2026-06-21} | 3–4 | span | med | progression | Must |
| E1 | E | de | **en** | {2023-10-21, 2024-02-14} | 2 | — | med | cross-lang hit | Must |
| E2 | E | en | **de** | ≥2 of {2023-03-09,2023-06-18,2024-08-14} | 2–3 | — | med | cross-lang hit | Must |
| E3 | E | es | **de** | ≥2 of {2023-06-18,09-05,03-09} | 2–3 | — | hard | cross-lang hit | Must |
| E4 | E | de | **es** | 2026-02-15 in evidence | 1–2 | — | hard | cross-lang hit | Should |
| E5 | E | en | **es** | ≥1 of {2024-07-12, 2025-08-22} | 1–2 | — | med | cross-lang hit | Must |
| E6 | E | es | **en** | 2024-11-08 in evidence | 1 | — | med | cross-lang hit | Should |
| E7 | E | de | mixed | 2024-12-01 in evidence | 1 | — | med | mixed-entry hit | Should |
| E8 | E | es | mixed | 2025-07-10 in evidence | 1 | — | hard | mixed-entry hit | Should |
| F1 | F | en | en | 2023-10-21 is earliest cited; later ones not presented as "first" | 1–3 | ordering | hard | "October 2023" | Should |
| F2 | F | de | de | {2023-06-18, 2023-09-05} both; exam + Aug-2024 absent | 2–3 | enumerate | hard | 2 entries | Should |
| F3 | F | de | de | 2026-05-03 &/or 2022-07-23; 2023-05-06 not top | 1–2 | — | hard | disambiguated | Should |
| F4 | F | en | de | ≥3 of {2022-09-03,2023-11-30,2025-06-07,2026-03-08} | 3–4 | enumerate | med | arc of the novel | Must |
| F5 | F | de | de | 2024-05-04 top; 2022-05-09 not top | 1 | ordering | med | "May 2024" | Should |
| V1 | — | de | de+en | ≥3 chips, all 2023 | 3–5 | year | med | stress+goal | Should |
| V2 | — | en | de+es | ≥3 chips, all 2025 | 3–5 | year | med | freelance year | Should |
| N1 | Neg | de | — (irrelevant) | (evidence ignored) | 0 | — | med | admits none | Should |
| N2 | Neg | en | — | — | 0 | — | med | admits none | Should |
| N3 | Neg | de/en | — | — | 0 | — | med | admits none | Should |
| N4 | Neg | de | de | **2022-04-11 top**, work-stress not presented | 1 | — | med | exam only | Must |
| N5 | Neg | en | — | — | 0/1 | future | hard | cautious | Should |
| N6 | Neg | any | — | **`chunks.length === 0`** → NO_EVIDENCE copy | 0 | — | easy | exact copy | Must |
| N7 | Neg | de | de | training entries, not a race | 1–2 | — | hard | no invented race | Nice |
| X1 | Adv | de | de | 2025-11-02 in evidence | 1 | — | med | short-entry hit | Should |
| X2 | Adv | en | de | 2023-06-18 in evidence + "June 2023" | 1 | — | hard | end-of-entry | Must |
| X3 | Adv | de | en | 2023... **2024-04-01 top** | 1 | — | hard | long-entry top | Must |
| X4 | Adv | en | de | 2024-08-14 in evidence | 1 | — | med | typo-entry hit | Should |
| X5–X7 | Adv | mixed | mixed | the mixed entry in evidence | 1 | — | med | mixed hit | Should |
| X8 | Adv | de | de | chip 2024-10-01; answer "15 Sept" not "1 Oct" | 1 | — | hard | date not confused | Must |
| X9 | Adv | en | de | 2025-02-11 in evidence; answer has the figures | 1 | — | med | number retrieval | Should |
| X10 | Adv | de | de | **2024-01-07 top**; ≥3 list items | 1 | — | med | bullets embed | Must |
| X11 | Adv | de | de | 2025-10-05 ≤2 chunks | 1 | — | med | dedupe cap | Nice |
| X12 | Adv | en | en+de | both 2024-11-08 and 2025-03-09 in evidence | 2 | — | hard | both sides | Should |
| X13 | Adv | en | de | 2023-09-05 in evidence | 1 | — | med | indirect hit | Should |
| X14 | Adv | en | de | ≥1 of {2023-06-18, 2023-09-05} | 1–2 | — | med | synonym hit | Should |
| X15 | Adv | de | de | ≥3 chips all 2023 | 3 | year | med | vague→synthesis | Should |
| X16 | Adv | en | de | #17 top, not the cooking line | 1 | — | med | keyword trap | Nice |
| X17 | Adv | de | es | answer "~2 years", not confused | 1 | — | hard | number-date trap | Nice |

**Tier totals (retrieval + generation queries): 62.**
Must = 22 · Should = 30 · Nice = 6 · plus non-query UI tests (§12).

---

## 12. Recommended Playwright test structure

```
playwright.config.ts            # projects: setup, chromium(main), ollama-down
.env.test                       # DATABASE_URL/DIRECT_URL → dedicated Neon branch or local pg
                                # OLLAMA_* same as dev; BETTER_AUTH_SECRET test value
e2e/
  fixtures/
    corpus.ts                   # the 60-entry spec as data: { date, lang, text, threads[], themes[] }
    test-account.ts             # { email, password, name }
    app.fixture.ts              # extends test: authedPage, prisma, ask(), waitForEmbeddings()
  seed/
    plain-to-tiptap.ts          # plain text (with \n\n paragraphs, "- " bullets) → Tiptap doc JSON
    seed.ts                     # upsert 60 JournalEntry via Prisma + run syncEntryEmbeddings per entry
    reset.ts                    # delete all rows for the test user (cascade clears chunks/memories)
  global-setup.ts               # 1) check Ollama health  2) run migrations on test DB
                                # 3) register first account via better-auth API  4) save storageState
                                # 5) seed corpus  6) waitForEmbeddings(all)
  global-teardown.ts            # reset.ts (unless KEEP_TEST_DATA=1)
  helpers/
    ask.ts                      # fill textarea, click Ask, await answer|error, parse evidence hrefs
    embeddings.ts               # poll prisma.entryChunk.count({ where: { embeddedAt: null }})
    activity.ts                 # read activity-cell links/titles for a year
  specs/
    auth.spec.ts                # register / login / logout / closed-registration / redirect     (~6)
    entries-authoring.spec.ts   # create today, backdate (typed + calendar), reject future,
                                # bold/italic/bullets round-trip, edit = update, one-per-day       (~9)
    activity-map.spec.ts        # seeded dates filled, year nav, future dashed, cell links         (~5)
    retrieval-factual.spec.ts   # Category A + F                                                   (~13)
    retrieval-semantic.spec.ts  # Category B + V                                                   (~9)
    retrieval-synthesis.spec.ts # Category C + D                                                   (~10)
    retrieval-crosslang.spec.ts # Category E + mixed-entry X5–X7                                   (~11)
    retrieval-negative.spec.ts  # N1–N7 (N6 runs in its own file BEFORE seed, or via reset)        (~7)
    retrieval-adversarial.spec.ts # X1–X4, X8–X17                                                  (~14)
    memories.spec.ts            # ask → save → list shows Q + dates → reload persists → delete     (~5)
    ollama-down.spec.ts         # (project: ollama-down, OLLAMA_BASE_URL=:1) ask shows down-state,
                                # entry save still works, overview still loads                     (~3)
  artifacts/                    # reflection-transcript.json, matrix-result.csv (git-ignored)
```

Key decisions:

- **Isolated database is mandatory.** The dev `DATABASE_URL` points at the user's real
  private journal. `.env.test` must point at a **separate Neon branch** (or local
  `pgvector/pgvector` container) with the same migrations, the `vector` extension and the
  HNSW index. `global-setup` runs `prisma migrate deploy` against it. **A safety guard**:
  `seed.ts` / `reset.ts` abort unless `DATABASE_URL` matches an allow-list pattern
  (e.g. contains `test` or `localhost`).
- **Seed via Prisma + the real embedding service, not the editor.** Driving the Tiptap
  editor 60× and waiting on `after()` is slow and flaky. Instead insert rows directly
  (reusing `hashContentText`) and call the production `syncEntryEmbeddings` for each — so
  chunking and embeddings are byte-for-byte what prod produces. The editor path is
  covered separately by `entries-authoring.spec.ts` on ~6 dedicated dates outside the
  corpus range.
- **`waitForEmbeddings`** polls `EntryChunk.embeddedAt` via Prisma (the fixture has DB
  access). No app change needed. Timeout 5 min for the full corpus.
- **One shared seeded DB, read-only for all retrieval specs.** They never write, so they
  can run in parallel workers against one Postgres. Generation still serialises on the
  single local Ollama — set `workers: 1` for the retrieval projects (or a small number and
  accept Ollama queuing).
- **`storageState`** from global-setup reused by every authed spec — no per-test login.
- **Ollama-down** is a separate Playwright *project* with `OLLAMA_BASE_URL` overridden to
  a dead port and its own `webServer`.
- **Answer non-determinism**: `helpers/ask.ts` retries the ask once on an answer-content
  miss; always appends both attempts to `reflection-transcript.json`.
- **`webServer`**: `next build && next start -p 3100` against `.env.test` for
  determinism (dev-mode recompiles mid-run cause timeouts). `reuseExistingServer: !CI`.

---

## 13. Recommended number of Playwright tests

| Group | Tests | Tier split |
|---|---|---|
| auth | 6 | Must 4 / Should 2 |
| entries-authoring | 9 | Must 6 / Should 3 |
| activity-map | 5 | Must 3 / Should 2 |
| retrieval-factual (A + F) | 13 | Must 6 / Should 6 / Nice 1 |
| retrieval-semantic (B + V) | 9 | Must 2 / Should 7 |
| retrieval-synthesis (C + D) | 10 | Must 5 / Should 5 |
| retrieval-crosslang (E + X5–7) | 11 | Must 4 / Should 7 |
| retrieval-negative (N) | 7 | Must 2 / Should 4 / Nice 1 |
| retrieval-adversarial (X) | 14 | Must 4 / Should 6 / Nice 4 |
| memories | 5 | Must 4 / Should 1 |
| ollama-down | 3 | Must 3 |
| **Total** | **~92** | **Must 43 / Should 50 / Nice 12 (–13 overlap)** ≈ **Must 40 / Should 40 / Nice 12** |

**Recommendation: ~90 Playwright tests.** Practical to run nightly (~25–40 min against a
warm local Ollama), too slow for every PR — see gaps.

CI gating:

- **Must pass** (≈40): block the merge/nightly-green. All UI-mechanics tests, all
  deterministic retrieval-direction tests, cross-language Must set, the N4/N6/X2/X3/X8/X10
  correctness traps.
- **Should pass** (≈40): reported, allowed to flake ≤10% over a 5-run window; investigated
  weekly.
- **Nice to pass** (≈12): `test.fixme`-style annotation — run and recorded, never gate.
- **Known difficult** (subset ≈5: C3, D1, D4, F1, X8, X12): kept in the suite with an
  explicit `annotation: 'known-difficult'`; a pass is a bonus signal about model/retrieval
  quality, a fail is logged for trend analysis, never a gate.

---

## 14. Gaps in the test strategy

1. **No embedding-completion signal in the app.** E2E must poll the DB directly from the
   fixture. Acceptable, but couples the test suite to the schema. *Option:* a test-only
   `GET /api/dev/entry-status?date=` route guarded by `NODE_ENV !== 'production'` — small,
   but it's an app change, so deferred and out of scope for the test-writing session
   unless the DB-poll proves unreliable.
2. **"No relevant entry" is not reachable through retrieval.** With any seeded data the
   LLM always gets 6 excerpts, so N1–N3/N5/N7 test generation grounding — the least
   deterministic behaviour. If negative-retrieval correctness matters, the app needs a
   **cosine-distance cutoff** in `retrieve()` (return `[]` when the nearest chunk is
   beyond a threshold). Flag for a future phase; not this one.
3. **Retrieval is date-blind.** The Memories UI never passes `dateRange`, so every
   temporal query (Category A year-scoped, all of D) depends on `llama3.1` reading the
   `Journal entry — YYYY-MM-DD` headers. Expect noise: a "2024 goals" query competes with
   2025/2026 goal entries. *Option:* parse a year/range out of the question and pass
   `dateRange` — future phase. For now, expected-relevant sets include the competitors as
   tolerated (not-top) rather than forbidden.
4. **Diversity cap bounds synthesis at 6 entries / 2 chunks per entry.** "How did my goals
   change 2022→2026" can never cite more than 6 dates. Every Category-C/D expected answer
   is scoped to "the main threads visible in ≤6 excerpts" with an explicit uncertainty
   caveat allowed. A genuinely exhaustive-timeline capability would need iterative /
   multi-query retrieval — not in scope.
5. **Generation non-determinism (no seed).** `llama3.1` at temp 0.2 still varies.
   Mitigations: loose keyword assertions, 1 retry, transcript artifact. *Option:* add an
   optional `seed` passthrough to `generate()` and set it in tests — small, justified,
   but an app change; propose it, don't do it in the test session.
6. **One entry per calendar day.** Cannot test "two entries same day, one relevant" or
   same-date evidence collision. Not fixable without a schema change that CLAUDE.md
   explicitly rules out — accept the limitation.
7. **Cost / time.** ~60 embeds + ~90 generations on a local Ollama ≈ 25–40 min/run.
   → nightly job, not per-PR. Per-PR could run only `auth` + `entries-authoring` +
   `activity-map` + a 5-query retrieval smoke (~8 min).
8. **Test-DB parity risk.** The Neon test branch must carry migration
   `20260827160000_embedding_model_bge_m3` (the `vector(1024)` column) **and** the HNSW
   index, or vector search silently returns nothing / errors. `global-setup` must
   `prisma migrate deploy` and assert the index exists.
9. **Clock dependency.** "Today" is 2026-08-27 in this environment. The seed (via Prisma)
   bypasses the future-date check, so 2026 entries are fine regardless of the CI clock.
   **But** `activity-map.spec.ts` (future = dashed) and `entries-authoring.spec.ts`
   (reject future date) read the real system clock. If CI runs with a wall-clock far from
   2026, "future" tests break. Pin the CI clock or make those two assertions relative to
   `new Date()` rather than hard-coded years.
10. **Query-language detection is untested territory.** There is none — everything rides
    on bge-m3. A German query containing an English proper noun, or a very short 2-word
    query, is under-covered. Added X17 and the very-short X1; more could be warranted.
11. **Answer-language not asserted.** `llama3.1` usually replies in the query language but
    not always. Assertions must accept query-language *or* English. Documented, not
    fixed.
12. **HNSW recall is approximate.** A correct entry could occasionally fall outside the 24
    candidates. Mitigation: the corpus is built so expected entries are *clearly* nearest
    (distinct vocabulary for distractors); retrieval Must-pass assertions use "in top 6"
    not "is #1" except where explicitly the point (X3, X10, N4).
13. **No LLM-judge for answer quality.** Keyword rubrics are coarse. A `llama3.1`-as-judge
    pass is possible but adds runtime and its own flakiness. Recommendation: keyword rubric
    for gating + the JSON transcript for periodic human spot-review; revisit a judge later.
14. **Memory-with-missing-entry edge unreachable.** `saveMemory` handles a cited date with
    no entry (writes `entryId: null`), but the seeded corpus can't produce it. Leave a
    unit test for that branch (already the right layer), don't force it in E2E.
15. **Concurrent embedding during a retrieval run.** If `entries-authoring` runs in
    parallel with retrieval specs against the shared DB, a half-embedded new entry could
    perturb results. Mitigation: authoring spec uses dates far outside the corpus and its
    own assertions; retrieval projects depend on the `setup` project only, and authoring
    runs in a later project. Or simply keep `fullyParallel: false` across projects.

---

## 15. Exact prompt for the next Claude Code session

> **Rearview — E2E test data + Playwright fixtures (implementation)**
>
> Read `CLAUDE.md` first, then `docs/testing/retrieval-e2e-plan.md` in full. Continue
> from the current repository state (HEAD on `master`); assume no memory of prior
> conversations.
>
> This session implements the seed corpus and the Playwright fixtures/harness from the
> plan. It does **not** yet write all ~90 test assertions — get the infrastructure solid
> and the Must-pass retrieval + UI tests green, then stop.
>
> **Scope for this session:**
>
> 1. **Isolated test database.** Add `.env.test` (git-ignored) with `DATABASE_URL` /
>    `DIRECT_URL` pointing at a **separate** Neon branch or a local
>    `pgvector/pgvector` container — never the dev database. Document the one-time setup
>    in `docs/testing/test-db-setup.md`. Add a hard guard in the seed/reset scripts that
>    aborts unless the DB URL matches an allow-list (`test` / `localhost`).
> 2. **Install Playwright** (`@playwright/test`), add `playwright.config.ts` with
>    `projects`: `setup`, `chromium`, `ollama-down`. `webServer` = `next build && next
>    start -p 3100` against `.env.test`. Add `test:e2e` scripts to `package.json`.
> 3. **`e2e/fixtures/corpus.ts`** — encode all 60 entries from the plan's §1 table as
>    structured data (`{ n, date, lang, lengthClass, threads, themes, text }`). Write
>    realistic entries matching the "tone lock" samples: German majority, the 5 mixed
>    entries, typos in #33, key admission last in #17, in-text date in #35, bullets in
>    #25, figures in #40. Keep long entries #8/#17/#29/#58 over 1,200 chars so they
>    multi-chunk.
> 4. **`e2e/seed/`** — `plain-to-tiptap.ts` (paragraphs on blank lines, `- ` → bullet
>    list), `seed.ts` (upsert 60 `JournalEntry` via Prisma reusing
>    `lib/editor/content-hash.ts`, then `await syncEntryEmbeddings(...)` per entry from
>    `lib/ai/entry-embeddings.service.ts`), `reset.ts` (delete the test user's rows).
> 5. **`e2e/global-setup.ts`** — check Ollama health (skip the run with a clear message if
>    `bge-m3` / `llama3.1` are missing, like the existing integration test);
>    `prisma migrate deploy` on the test DB and assert the HNSW index exists; register the
>    first account through the better-auth API; save `storageState`; seed; then
>    `waitForEmbeddings(all)` (poll `EntryChunk.embeddedAt IS NULL` → 0, 5-min timeout).
>    `global-teardown.ts` runs `reset.ts` unless `KEEP_TEST_DATA=1`.
> 6. **`e2e/fixtures/app.fixture.ts`** — extend `test` with `prisma`, `authedPage`,
>    `ask(question)` → `{ answer, evidenceDates, error }` (parse evidence chip `href`s),
>    `waitForEmbeddings(dates)`.
> 7. **Specs — this session implements only:**
>    - `auth.spec.ts` (all 6)
>    - `entries-authoring.spec.ts` (all 9 — use dates 2021-xx and 2020-xx, outside the
>      corpus; verify the `after()` embedding job via `waitForEmbeddings`)
>    - `activity-map.spec.ts` (all 5)
>    - `retrieval-crosslang.spec.ts` — the 6 **Must** direction tests (E1, E2, E3, E5 +
>      X2, X3)
>    - `retrieval-factual.spec.ts` — the Category A **Must** set (A1, A2, A4, A5, A7, A8)
>    - `retrieval-negative.spec.ts` — N4 and N6 only
>    - `retrieval-adversarial.spec.ts` — X8, X10 only
>    - `memories.spec.ts` (all 5)
>    - `ollama-down.spec.ts` (all 3)
>    Assertions per the plan's §10 grading model: strict on evidence dates, loose regex on
>    answer content, 1 retry on answer-content misses, write
>    `e2e/artifacts/reflection-transcript.json`.
> 8. Leave `retrieval-semantic`, `retrieval-synthesis`, the remaining
>    `retrieval-factual`/`negative`/`adversarial` cases as a written **TODO list**
>    (`e2e/specs/TODO.md`) mapping every remaining query ID from §11 to its file — the
>    session after this one fills them in.
>
> **Do not:** touch the dev database; add a similarity cutoff, a `seed` param, or a
> `dateRange` wiring to the app (those are noted as future options in the plan, not this
> session); add hosted-AI anything.
>
> **Definition of done:** `npm run test:e2e` green on the implemented specs against a
> local Ollama + the test DB; lint + typecheck pass; `docs/testing/test-db-setup.md`
> written; `e2e/specs/TODO.md` lists the deferred assertions; a short summary of what was
> built and the exact prompt for the following session (fill in the remaining retrieval
> assertions).
```

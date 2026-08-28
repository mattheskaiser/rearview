import { beforeAll, describe, expect, it } from "vitest";

import { chunkText } from "@/lib/ai/chunking";
import { embedMany, embedText } from "@/lib/ai/embedding.service";
import { checkOllamaHealth } from "@/lib/ai/ollama-health.service";
import { rerankForDiversity } from "@/lib/retrieval.service";
import { CORPUS, corpusEntryByDate, type CorpusLang } from "@/e2e/fixtures/corpus";

/**
 * Cross-language retrieval, exercised against a real local Ollama + bge-m3
 * (docs/testing/retrieval-e2e-plan.md §9 "Level 2 — embedding-space proof").
 *
 * This is the vector-level companion to the Playwright retrieval suite: both run
 * on the *same* 60-entry synthetic journal (`e2e/fixtures/corpus.ts`), so what
 * the E2E specs assert through the Memories UI is grounded here in the raw
 * embedding geometry. Nothing on this path touches Postgres — it embeds the
 * corpus texts directly and compares them.
 *
 * Two levels of proof:
 *  1. Entry-to-entry — two entries that describe the same thing in different
 *     languages, sharing no vocabulary, are still near neighbours in both
 *     directions. This is the core evidence that the space is language-agnostic.
 *  2. Query-to-entry — a natural-language question in one language surfaces the
 *     evidence written in another, across all six pairwise directions and into
 *     the code-switched entries.
 */

const health = await checkOllamaHealth();
const ready = health.reachable && health.embedding.available;

if (!ready) {
  console.warn(
    `[integration] skipping — Ollama reachable: ${health.reachable}, ` +
      `${health.embedding.model} pulled: ${health.embedding.available}`,
  );
}

/** bge-m3 batches slowly here (~0.5 s/entry); a 60-input call exceeds the
 *  embed timeout, so the corpus is embedded in chunks. */
const EMBED_BATCH = 12;

const primaryLang = (lang: CorpusLang): "de" | "en" | "es" =>
  lang.split("+")[0] as "de" | "en" | "es";

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}
const cosine = (a: number[], b: number[]) =>
  dot(a, b) / (Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b)));

/**
 * Curated cross-language sibling pairs: `[a, b]` are written in different
 * primary languages, describe the same specific thing, and share essentially no
 * surface vocabulary. Each must be a near neighbour of the other — strongly in
 * at least one direction, comfortably in both.
 */
const CROSS_LANGUAGE_PAIRS: { a: string; b: string; concept: string }[] = [
  { a: "2022-03-20", b: "2025-05-18", concept: "the half-marathon goal" },
  { a: "2022-01-08", b: "2025-05-18", concept: "the half-marathon goal" },
  { a: "2022-10-17", b: "2025-05-18", concept: "running motivation fading, then let go" },
  { a: "2024-01-19", b: "2026-06-21", concept: "learning Spanish" },
  { a: "2022-07-23", b: "2024-01-19", concept: "wanting to, then starting to, learn Spanish" },
  { a: "2023-03-09", b: "2023-04-18", concept: "the office workload is crushing" },
  { a: "2023-06-18", b: "2023-04-18", concept: "burnout / overwhelm" },
  { a: "2024-05-04", b: "2024-06-15", concept: "a calm, contented day" },
  { a: "2026-08-04", b: "2024-06-15", concept: "a quiet, good day" },
  { a: "2026-02-15", b: "2024-11-08", concept: "freelancing was the right call" },
];

/**
 * One question per pairwise direction (§9 Level-1 table), each phrased so its
 * only relevant evidence is in another language, or inside a code-switched
 * entry. `need` of `evidence` must land within the top `within`.
 */
type Direction = {
  id: string;
  queryLang: "de" | "en" | "es";
  query: string;
  /** Evidence dates, all in a language other than `queryLang`. */
  evidence: string[];
  need: number;
  within: number;
};

const DIRECTIONS: Direction[] = [
  {
    id: "de→en",
    queryLang: "de",
    query: "Wann war ich unsicher, was meine Karriere angeht?",
    evidence: ["2023-10-21"],
    need: 1,
    within: 3,
  },
  {
    id: "en→de",
    queryLang: "en",
    query: "When was I overwhelmed by work?",
    evidence: ["2023-02-02", "2023-06-18", "2023-09-05", "2023-03-09"],
    need: 2,
    within: 6,
  },
  {
    id: "es→de",
    queryLang: "es",
    query: "¿Cuándo estuve al límite por el trabajo?",
    evidence: ["2023-02-02", "2023-06-18", "2024-08-14", "2023-09-05", "2023-03-09"],
    need: 2,
    within: 6,
  },
  {
    id: "de→es",
    queryLang: "de",
    query: "Wann habe ich mich optimistischer wegen der Arbeit gefühlt?",
    evidence: ["2026-02-15"],
    need: 1,
    within: 1,
  },
  {
    id: "en→es",
    queryLang: "en",
    query: "When did I take a proper trip to disconnect from work?",
    evidence: ["2024-07-12", "2025-08-22"],
    need: 1,
    within: 3,
  },
  {
    id: "es→en",
    queryLang: "es",
    query: "¿Cuándo sentí que hacerme autónomo fue la decisión correcta?",
    evidence: ["2024-11-08"],
    need: 1,
    within: 1,
  },
  {
    id: "de→mixed(de+en)",
    queryLang: "de",
    query: "Notiz über Motivation und das Weitermachen, wenn es schwer ist",
    evidence: ["2024-12-01"],
    need: 1,
    within: 1,
  },
  {
    id: "es→mixed(de+es)",
    queryLang: "es",
    query: "¿Cuándo hablé una hora entera solo en español con un amigo?",
    evidence: ["2025-07-10"],
    need: 1,
    within: 3,
  },
];

describe.skipIf(!ready)("multilingual + cross-language retrieval (bge-m3)", () => {
  const vectors = new Map<string, number[]>();

  beforeAll(async () => {
    const texts = CORPUS.map((entry) => entry.text);
    const embedded: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      embedded.push(...(await embedMany(texts.slice(i, i + EMBED_BATCH))));
    }
    CORPUS.forEach((entry, i) => vectors.set(entry.date, embedded[i]));
  }, 300_000);

  /** Rank of `to` among every other corpus entry, by similarity to `from`. */
  function neighbourRank(from: string, to: string): number {
    return CORPUS.filter((entry) => entry.date !== from)
      .map((entry) => ({
        date: entry.date,
        score: cosine(vectors.get(from)!, vectors.get(entry.date)!),
      }))
      .sort((a, b) => b.score - a.score)
      .findIndex((entry) => entry.date === to);
  }

  /** Corpus entry dates ordered by similarity to a query vector. */
  function rankedDates(queryVector: number[]): string[] {
    return CORPUS.map((entry) => ({
      date: entry.date,
      score: cosine(queryVector, vectors.get(entry.date)!),
    }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.date);
  }

  it("embeds German, English, Spanish and code-switched entries to bge-m3's 1024 dimensions", () => {
    for (const lang of ["de", "en", "es"] as const) {
      const entry = CORPUS.find((e) => e.lang === lang)!;
      expect(vectors.get(entry.date)).toHaveLength(1024);
    }
    for (const entry of CORPUS.filter((e) => e.lang.includes("+"))) {
      expect(vectors.get(entry.date), `mixed entry ${entry.date}`).toHaveLength(1024);
    }
  });

  // ---- 1. entry-to-entry: the space itself is language-agnostic ----------
  it.each(CROSS_LANGUAGE_PAIRS)(
    "$a and $b are cross-language near neighbours ($concept)",
    ({ a, b }) => {
      const langA = primaryLang(corpusEntryByDate(a)!.lang);
      const langB = primaryLang(corpusEntryByDate(b)!.lang);
      expect(langA).not.toEqual(langB);

      const forward = neighbourRank(a, b);
      const backward = neighbourRank(b, a);
      const label = `${a}->${b}=${forward}, ${b}->${a}=${backward}`;

      // Strongly a neighbour one way, comfortably a neighbour both ways.
      expect(Math.min(forward, backward), label).toBeLessThanOrEqual(6);
      expect(Math.max(forward, backward), label).toBeLessThanOrEqual(15);
    },
  );

  // ---- 2. query-to-entry: every pairwise language direction --------------
  it.each(DIRECTIONS)(
    "$id — a $queryLang question surfaces evidence in another language",
    async ({ query, queryLang, evidence, need, within }) => {
      // No evidence entry is a pure entry in the query's own language.
      for (const date of evidence) {
        expect(corpusEntryByDate(date)!.lang).not.toEqual(queryLang);
      }

      const top = rankedDates(await embedText(query)).slice(0, within);
      const hits = evidence.filter((date) => top.includes(date));
      expect(
        hits.length,
        `top ${within}: ${top.join(", ")} — wanted ${need} of ${evidence.join(", ")}`,
      ).toBeGreaterThanOrEqual(need);
    },
  );

  it("bridges languages for the top hit in most of the direction matrix", async () => {
    let crossed = 0;
    for (const direction of DIRECTIONS) {
      const [topDate] = rankedDates(await embedText(direction.query));
      if (primaryLang(corpusEntryByDate(topDate)!.lang) !== direction.queryLang) {
        crossed += 1;
      }
    }
    expect(crossed).toBeGreaterThanOrEqual(5);
  });

  it("retrieves code-switched entries that mix two languages", async () => {
    const deEn = rankedDates(
      await embedText("Wann habe ich mir vorgenommen, trotz Schwierigkeiten weiterzumachen?"),
    ).slice(0, 3);
    expect(deEn).toContain("2024-12-01"); // de+en

    const deEs = rankedDates(
      await embedText("¿Cuándo tuve una conversación entera en español con un amigo?"),
    ).slice(0, 3);
    expect(deEs).toContain("2025-07-10"); // de+es
  });

  // ---- 3. long entries: chunking keeps them retrievable -----------------
  it("splits a long entry into chunks and still ranks it above unrelated entries", async () => {
    const monday = corpusEntryByDate("2024-04-01")!;
    const chunks = chunkText(monday.text);
    expect(chunks.length).toBeGreaterThan(1);

    const chunkVectors = await embedMany(chunks.map((c) => c.text));
    const queryVector = await embedText("Wie war ein typischer Montag im Büro?");

    const bestChunk = Math.max(...chunkVectors.map((v) => cosine(queryVector, v)));
    const unrelated = ["2024-06-15", "2026-06-21", "2022-06-11", "2025-08-22", "2023-01-05"];
    const bestUnrelated = Math.max(
      ...unrelated.map((date) => cosine(queryVector, vectors.get(date)!)),
    );
    expect(bestChunk).toBeGreaterThan(bestUnrelated);

    expect(rankedDates(queryVector)[0]).toEqual("2024-04-01");
  });

  it("chunk coverage surfaces an admission buried in a long entry's final paragraph", async () => {
    const burnout = corpusEntryByDate("2023-06-18")!; // "ich bin ausgebrannt" lands last
    const chunks = chunkText(burnout.text);
    expect(chunks.length).toBeGreaterThan(1);

    const chunkVectors = await embedMany(chunks.map((c) => c.text));
    const queryVector = await embedText("When did I admit I was burned out?");
    const perChunk = chunkVectors.map((v) => cosine(queryVector, v));

    // The closing chunk (with the admission) must beat the opening one.
    expect(perChunk[perChunk.length - 1]).toBeGreaterThan(perChunk[0]);
  });

  it("feeds real cross-language distances through the diversity reranker", async () => {
    const queryVector = await embedText("Ziele, Motivation und persönliches Wachstum über die Jahre");
    const matches = CORPUS.map((entry) => ({
      entryId: entry.date,
      journalDate: new Date(`${entry.date}T00:00:00.000Z`),
      chunkIndex: 0,
      text: entry.text,
      distance: 1 - cosine(queryVector, vectors.get(entry.date)!),
    }));

    const result = rerankForDiversity(matches, 6);
    expect(result).toHaveLength(6);
    expect(new Set(result.map((m) => m.entryId)).size).toBe(6);
  });
});

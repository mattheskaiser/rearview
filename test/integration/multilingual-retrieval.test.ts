import { beforeAll, describe, expect, it } from "vitest";

import { chunkText } from "@/lib/ai/chunking";
import { embedMany, embedText } from "@/lib/ai/embedding.service";
import { checkOllamaHealth } from "@/lib/ai/ollama-health.service";
import { rerankForDiversity } from "@/lib/retrieval.service";
import {
  MULTILINGUAL_CORPUS,
  type CorpusLang,
} from "@/test/fixtures/multilingual-corpus";

/**
 * Cross-language retrieval, exercised against a real local Ollama + bge-m3
 * (session prompt > Cross language retrieval / Testing).
 *
 * Two levels of proof:
 *  1. Entry-to-entry — every entry's nearest neighbours in the corpus are its
 *     same-theme siblings in the other languages. Phrasing-independent, so this
 *     is the core evidence that the embedding space is language-agnostic.
 *  2. Query-to-entry — a natural-language question in one language surfaces the
 *     theme's entries written in the other two languages.
 */

const health = await checkOllamaHealth();
const ready = health.reachable && health.embedding.available;

if (!ready) {
  console.warn(
    `[integration] skipping — Ollama reachable: ${health.reachable}, ` +
      `${health.embedding.model} pulled: ${health.embedding.available}`,
  );
}

const LANGS: CorpusLang[] = ["de", "en", "es"];

/** One natural-language query per theme, in each language. */
const THEME_QUERIES: Record<string, Record<CorpusLang, string>> = {
  goals: {
    de: "Welche konkreten Ziele wollte ich dieses Jahr erreichen?",
    en: "Which concrete targets did I want to hit this year?",
    es: "¿Qué objetivos concretos quería lograr este año?",
  },
  stress: {
    de: "Wann stand ich bei der Arbeit stark unter Druck?",
    en: "When was I under heavy pressure at work?",
    es: "¿Cuándo estuve bajo mucha presión en el trabajo?",
  },
  relationships: {
    de: "Was habe ich über Freundschaft und Familie festgehalten?",
    en: "What did I record about friendship and family?",
    es: "¿Qué anoté sobre la amistad y la familia?",
  },
  happiness: {
    de: "Wann hatte ich einen ruhigen, zufriedenen Tag?",
    en: "When did I have a calm, contented day?",
    es: "¿Cuándo tuve un día tranquilo y a gusto?",
  },
  growth: {
    de: "Wie habe ich gelernt, Grenzen zu setzen und mich abzugrenzen?",
    en: "How did I learn to set boundaries and say no?",
    es: "¿Cómo aprendí a poner límites y a decir que no?",
  },
  motivation: {
    de: "Wann habe ich versucht, meinen Antrieb wiederzufinden?",
    en: "When did I try to get my motivation back?",
    es: "¿Cuándo intenté recuperar mi motivación?",
  },
};

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}
const cosine = (a: number[], b: number[]) =>
  dot(a, b) / (Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b)));

const themeOf = (id: string) =>
  MULTILINGUAL_CORPUS.find((e) => e.id === id)!.theme;

describe.skipIf(!ready)("multilingual + cross-language retrieval (bge-m3)", () => {
  const vectors = new Map<string, number[]>();

  beforeAll(async () => {
    const embedded = await embedMany(MULTILINGUAL_CORPUS.map((e) => e.text));
    MULTILINGUAL_CORPUS.forEach((entry, i) => vectors.set(entry.id, embedded[i]));
  });

  function ranked(queryVector: number[]) {
    return MULTILINGUAL_CORPUS.map((entry) => ({
      id: entry.id,
      theme: entry.theme,
      score: cosine(queryVector, vectors.get(entry.id)!),
    })).sort((a, b) => b.score - a.score);
  }

  it("embeds German, English and Spanish to bge-m3's 1024 dimensions", () => {
    for (const lang of LANGS) {
      const entry = MULTILINGUAL_CORPUS.find((e) => e.lang === lang)!;
      expect(vectors.get(entry.id)).toHaveLength(1024);
    }
  });

  // ---- 1. entry-to-entry: the space itself is language-agnostic ----------
  const themed = MULTILINGUAL_CORPUS.filter((e) => e.theme !== "daily-life");

  it.each(themed.map((e) => ({ id: e.id, lang: e.lang, theme: e.theme })))(
    "nearest neighbours of $theme/$lang entry ($id) are its cross-language siblings",
    ({ id, theme }) => {
      const siblings = MULTILINGUAL_CORPUS.filter(
        (e) => e.theme === theme && e.id !== id,
      ).length;

      const neighbours = MULTILINGUAL_CORPUS.filter((e) => e.id !== id)
        .map((e) => ({ theme: e.theme, score: cosine(vectors.get(id)!, vectors.get(e.id)!) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, siblings);

      expect(neighbours.every((n) => n.theme === theme)).toBe(true);
    },
  );

  // ---- 2. query-to-entry: all 9 language directions per theme -----------
  const cases = Object.keys(THEME_QUERIES).flatMap((theme) =>
    LANGS.map((queryLang) => ({ theme, queryLang })),
  );
  const matrix: string[] = [];

  it.each(cases)(
    "$queryLang query for '$theme' retrieves the theme's other-language entries",
    async ({ theme, queryLang }) => {
      const queryVector = await embedText(THEME_QUERIES[theme][queryLang]);
      const top = ranked(queryVector).slice(0, 6);
      const topIds = top.map((r) => r.id);

      matrix.push(
        `${queryLang} "${theme}": ` +
          top.slice(0, 3).map((r) => `${r.id}(${r.score.toFixed(2)})`).join(", "),
      );

      const crossLangTargets = MULTILINGUAL_CORPUS.filter(
        (e) => e.theme === theme && e.lang !== queryLang,
      ).map((e) => e.id);

      for (const target of crossLangTargets) {
        expect(topIds, `top-6 [${queryLang}/${theme}]: ${topIds.join(", ")}`).toContain(
          target,
        );
      }
    },
  );

  it("ranks an on-theme entry first for the large majority of queries", async () => {
    let onThemeTop1 = 0;
    for (const { theme, queryLang } of cases) {
      const queryVector = await embedText(THEME_QUERIES[theme][queryLang]);
      if (themeOf(ranked(queryVector)[0].id) === theme) onThemeTop1 += 1;
    }
    console.log("\n[cross-language retrieval — top 3 per query]\n" + matrix.join("\n"));
    expect(onThemeTop1 / cases.length).toBeGreaterThanOrEqual(0.8);
  });

  it("retrieves a single entry that mixes German, English and Spanish", async () => {
    const queryVector = await embedText(
      "Notiz über Motivation und darüber, weiterzumachen, wenn es schwer ist",
    );
    expect(ranked(queryVector).slice(0, 3).map((r) => r.id)).toContain(
      "mixed-language",
    );
  });

  it("chunks a long entry and still retrieves it above unrelated entries", async () => {
    const long = MULTILINGUAL_CORPUS.find((e) => e.id === "long-workday-en")!;
    const chunks = chunkText(long.text);
    expect(chunks.length).toBeGreaterThan(1);

    const chunkVectors = await embedMany(chunks.map((c) => c.text));
    const queryVector = await embedText("Wie sah ein gewöhnlicher Arbeitstag bei mir aus?");

    const bestChunk = Math.max(...chunkVectors.map((v) => cosine(queryVector, v)));
    const bestOther = Math.max(
      ...MULTILINGUAL_CORPUS.filter((e) => e.theme !== "daily-life").map((e) =>
        cosine(queryVector, vectors.get(e.id)!),
      ),
    );
    expect(bestChunk).toBeGreaterThan(bestOther);
  });

  it("feeds real cross-language distances through the diversity reranker", async () => {
    const queryVector = await embedText("Ziele, Motivation und persönliches Wachstum");
    const matches = MULTILINGUAL_CORPUS.map((entry) => ({
      entryId: entry.id,
      journalDate: new Date(`${entry.date}T00:00:00.000Z`),
      chunkIndex: 0,
      text: entry.text,
      distance: 1 - cosine(queryVector, vectors.get(entry.id)!),
    }));

    const result = rerankForDiversity(matches, 6);
    expect(result).toHaveLength(6);
    expect(new Set(result.map((m) => m.entryId)).size).toBe(6);
  });
});

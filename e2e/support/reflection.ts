import { readFileSync, writeFileSync } from "node:fs";

import { expect } from "@playwright/test";

import type { AskOutcome } from "../fixtures/app.fixture";

/**
 * Grading model for retrieval / generation queries (plan §10):
 *  - evidence-date assertions are strict and get NO retry (a miss is a miss);
 *  - answer-content assertions are loose regexes and get ONE retry of the whole
 *    ask, because llama3.1 at temp 0.2 with no seed occasionally phrases an
 *    otherwise-correct answer past the regex;
 *  - every attempt is appended to `e2e/artifacts/reflection-transcript.json`.
 */

export const TRANSCRIPT_PATH = "e2e/artifacts/reflection-transcript.json";

export type ReflectionSpec = {
  /** Matrix ID from plan §11, e.g. "A1". */
  id: string;
  question: string;
  queryLang: "de" | "en" | "es";
  tier: "must" | "should" | "nice" | "difficult";
  /** Every date here must appear among the evidence chips. */
  expectRelevantDates?: string[];
  /** At least this many of `expectRelevantDates` must appear (instead of all). */
  minRelevant?: number;
  /** This date must be the first evidence chip. */
  expectTopDate?: string;
  /** None of these may be the 1st or 2nd evidence chip. */
  expectAbsentDates?: string[];
  /** `evidence.length >= 2`. */
  expectMultiEntry?: boolean;
  /** All must match the answer (case-insensitive). */
  expectAnswerIncludes?: RegExp[];
  /** None may match the answer. */
  expectAnswerExcludes?: RegExp[];
  /** Answer must acknowledge uncertainty / missing evidence. */
  expectUncertainty?: boolean;
  /** The ask is expected to fail with an error matching this. */
  expectError?: RegExp;
};

export const UNCERTAINTY_RE =
  /nicht genug|keine Einträge|keine Hinweise|unklar|weiß nicht|not enough|no entries|nothing (about|in)|no menciono|no hay|insufficient|can'?t tell|doesn'?t (say|mention|record)/i;

type Attempt = { attempt: number; answer: string; evidenceDates: string[]; error: string | null };

function appendTranscript(entry: {
  id: string;
  question: string;
  queryLang: string;
  tier: string;
  attempts: Attempt[];
}): void {
  let all: unknown[] = [];
  try {
    all = JSON.parse(readFileSync(TRANSCRIPT_PATH, "utf8"));
    if (!Array.isArray(all)) all = [];
  } catch {
    all = [];
  }
  all.push({ ...entry, recordedAt: new Date().toISOString() });
  writeFileSync(TRANSCRIPT_PATH, JSON.stringify(all, null, 2));
}

/** Strict evidence-date checks — never retried. */
function assertEvidence(spec: ReflectionSpec, out: AskOutcome): void {
  const { evidenceDates } = out;
  const where = `[${spec.id}] evidence: ${evidenceDates.join(", ") || "(none)"}`;

  if (spec.expectTopDate) {
    expect(evidenceDates[0], `${where} — expected top chip ${spec.expectTopDate}`).toBe(
      spec.expectTopDate,
    );
  }

  if (spec.expectRelevantDates?.length) {
    const present = spec.expectRelevantDates.filter((d) => evidenceDates.includes(d));
    if (spec.minRelevant != null) {
      expect(
        present.length,
        `${where} — expected ≥${spec.minRelevant} of ${spec.expectRelevantDates.join(", ")}`,
      ).toBeGreaterThanOrEqual(spec.minRelevant);
    } else {
      expect(
        present,
        `${where} — expected all of ${spec.expectRelevantDates.join(", ")}`,
      ).toEqual(expect.arrayContaining(spec.expectRelevantDates));
    }
  }

  for (const distractor of spec.expectAbsentDates ?? []) {
    const idx = evidenceDates.indexOf(distractor);
    if (idx !== -1) {
      expect(idx, `${where} — distractor ${distractor} must not be a top-2 chip`).toBeGreaterThan(1);
    }
  }

  if (spec.expectMultiEntry) {
    expect(evidenceDates.length, `${where} — expected multi-entry evidence`).toBeGreaterThanOrEqual(2);
  }
}

/** Loose answer-content checks — retried once by the caller. */
function answerMisses(spec: ReflectionSpec, answer: string): string[] {
  const misses: string[] = [];
  for (const re of spec.expectAnswerIncludes ?? []) {
    if (!re.test(answer)) misses.push(`missing ${re}`);
  }
  for (const re of spec.expectAnswerExcludes ?? []) {
    if (re.test(answer)) misses.push(`should not contain ${re}`);
  }
  if (spec.expectUncertainty && !UNCERTAINTY_RE.test(answer)) {
    misses.push("expected an uncertainty acknowledgement");
  }
  return misses;
}

export async function runReflection(
  ask: (q: string) => Promise<AskOutcome>,
  spec: ReflectionSpec,
): Promise<AskOutcome> {
  const attempts: Attempt[] = [];

  try {
    const first = await ask(spec.question);
    attempts.push({ attempt: 1, ...first });

    if (spec.expectError) {
      expect(first.error, `[${spec.id}] expected an error`).not.toBeNull();
      expect(first.error ?? "").toMatch(spec.expectError);
      return first;
    }

    expect(first.error, `[${spec.id}] unexpected error: ${first.error}`).toBeNull();
    assertEvidence(spec, first);

    let misses = answerMisses(spec, first.answer);
    let final = first;

    if (misses.length > 0) {
      const second = await ask(spec.question);
      attempts.push({ attempt: 2, ...second });
      if (second.error === null) {
        assertEvidence(spec, second);
        const secondMisses = answerMisses(spec, second.answer);
        if (secondMisses.length < misses.length) {
          misses = secondMisses;
          final = second;
        }
      }
    }

    expect(misses, `[${spec.id}] answer: ${final.answer}`).toEqual([]);
    return final;
  } finally {
    appendTranscript({ ...specHeader(spec), attempts });
  }
}

function specHeader(spec: ReflectionSpec) {
  return {
    id: spec.id,
    question: spec.question,
    queryLang: spec.queryLang,
    tier: spec.tier,
  };
}

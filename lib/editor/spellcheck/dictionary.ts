"use client";
import nspell, { type NSpell } from "nspell";

import { addUserWord, loadUserWords } from "./store";

/**
 * Local Hunspell spell checker (English + German). Both dictionaries are served
 * from the app's own origin (`/dictionaries/*`, vendored by
 * `scripts/sync-dictionaries.mjs`) and checked in the browser — no text ever
 * leaves the machine. A word is accepted if either language accepts it, or if
 * the user has ignored / added it.
 */

export type Checker = {
  /** Whether `word` should be treated as correctly spelled. */
  ok: (word: string) => boolean;
  /** Up to a few correction suggestions. */
  suggest: (word: string) => string[];
  /** Ignore `word` for this session only. */
  ignore: (word: string) => void;
  /** Add `word` to the persistent personal dictionary. */
  add: (word: string) => void;
};

let checkerPromise: Promise<Checker> | null = null;
let ready: Checker | null = null;
/** Bumped whenever the ignore/added set changes, so the editor re-checks. */
let revision = 0;
export const getRevision = () => revision;

async function fetchDictionary(lang: string) {
  const [aff, dic] = await Promise.all([
    fetch(`/dictionaries/${lang}.aff`).then((r) => r.text()),
    fetch(`/dictionaries/${lang}.dic`).then((r) => r.text()),
  ]);
  return nspell(aff, dic);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Approximate German noun compounding, which the flat Hunspell word list +
 * nspell don't cover (`Bahnhof`, `Wochenende`, `Krankenversicherung`, …). Accept
 * the word if it splits into two known German parts, allowing a linking "s".
 */
function isGermanCompound(de: NSpell, word: string): boolean {
  if (word.length < 6) return false;
  for (let i = 3; i <= word.length - 3; i += 1) {
    const head = word.slice(0, i);
    if (!de.correct(head) && !de.correct(head.toLowerCase())) continue;
    const tail = word.slice(i);
    if (de.correct(tail) || de.correct(cap(tail)) || de.correct(tail.toLowerCase())) {
      return true;
    }
    if (tail[0] === "s" && tail.length > 4) {
      const inner = tail.slice(1);
      if (de.correct(inner) || de.correct(cap(inner))) return true;
    }
  }
  return false;
}

function build(en: NSpell, de: NSpell): Checker {
  const session = new Set<string>();
  const persistent = new Set(loadUserWords().map((w) => w.toLowerCase()));

  const known = (word: string) => {
    const lower = word.toLowerCase();
    if (session.has(lower) || persistent.has(lower)) return true;
    return en.correct(word) || de.correct(word) || isGermanCompound(de, word);
  };

  return {
    ok: (word) => known(word),
    suggest: (word) =>
      [...new Set([...en.suggest(word), ...de.suggest(word)])].slice(0, 6),
    ignore: (word) => {
      session.add(word.toLowerCase());
      revision += 1;
    },
    add: (word) => {
      persistent.add(word.toLowerCase());
      addUserWord(word);
      revision += 1;
    },
  };
}

/** Load the checker once; callers await readiness and re-check on resolve. */
export function loadChecker(): Promise<Checker> {
  checkerPromise ??= Promise.all([
    fetchDictionary("en"),
    fetchDictionary("de"),
  ])
    .then(([en, de]) => build(en, de))
    .then((checker) => {
      ready = checker;
      revision += 1;
      return checker;
    });
  return checkerPromise;
}

/** The checker if it has finished loading, else null (don't flag anything yet). */
export function getReadyChecker(): Checker | null {
  return ready;
}

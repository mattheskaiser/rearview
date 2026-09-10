"use client";

/**
 * The user's personal spell-check dictionary — words they chose "Add to
 * dictionary" for, so they are never flagged again. A per-viewer convenience,
 * kept in `localStorage` (CLAUDE.md storage note: wrap every access in
 * try/catch, tolerate it being empty or unavailable).
 */

const KEY = "rearview-spellcheck-dictionary";

export function loadUserWords(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((w): w is string => typeof w === "string")
      : [];
  } catch {
    return [];
  }
}

export function addUserWord(word: string): void {
  try {
    const next = new Set(loadUserWords());
    next.add(word);
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // No persistence available — the in-memory session copy still applies.
  }
}

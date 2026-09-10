import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { addUserWord, loadUserWords } from "./store";

/** Minimal in-memory localStorage (the unit env is node, no DOM). */
function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    ...overrides,
  };
}

describe("spellcheck personal dictionary store", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("starts empty and round-trips added words without duplicates", () => {
    expect(loadUserWords()).toEqual([]);

    addUserWord("StateSafe");
    addUserWord("Neon");
    addUserWord("StateSafe");

    expect(loadUserWords().sort()).toEqual(["Neon", "StateSafe"]);
  });

  it("returns [] for malformed storage instead of throwing", () => {
    localStorage.setItem("rearview-spellcheck-dictionary", "not json");
    expect(loadUserWords()).toEqual([]);
  });

  it("tolerates localStorage writes failing", () => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage({
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => addUserWord("Whatever")).not.toThrow();
  });
});

"use client";
import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/** localStorage key for the explicit user choice — a UI preference, never journal content. */
const STORAGE_KEY = "rearview-theme";

const listeners = new Set<() => void>();

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    // Storage unavailable (private browsing, disabled) — fall back to system.
    return null;
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Current theme, read from the `<html>` class the inline script (or a prior `setTheme`) applied. */
function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Deterministic value for the server render and the client's first pass, before hydration can read the DOM. */
function getServerSnapshot(): Theme {
  return "light";
}

/**
 * Persists an explicit choice and applies it immediately. A later system
 * preference change won't override it — see `subscribe` below.
 */
function setTheme(next: Theme): void {
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Preference just won't survive a refresh this session.
  }
  for (const listener of listeners) listener();
}

/**
 * Keeps the theme in sync with the OS preference for as long as the user
 * hasn't made an explicit choice, and notifies `useSyncExternalStore`
 * whenever `setTheme` runs so every subscribed component re-reads the class.
 */
function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    if (readStoredTheme() !== null) return;
    applyTheme(media.matches ? "dark" : "light");
    onStoreChange();
  };
  media.addEventListener("change", onMediaChange);
  return () => {
    listeners.delete(onStoreChange);
    media.removeEventListener("change", onMediaChange);
  };
}

const noopSubscribe = () => () => {};

/**
 * Light/dark theme state, backing the Sidebar's toggle.
 *
 * `useSyncExternalStore` (rather than `useState` + an effect) is what lets
 * `theme` and `mounted` differ between the server render and the client's
 * first pass without a "why did this change after mount" React warning: the
 * server snapshot is always `"light"` / `false`, and the *real* value — set
 * synchronously before hydration by the inline script in the root layout —
 * is only read once the DOM is available. There is no flash of the wrong
 * theme; there's a one-frame placeholder icon (see `ThemeToggle`) instead of
 * a hydration mismatch.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const toggle = useCallback(() => {
    setTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, []);

  return { theme, mounted, toggle, setTheme };
}

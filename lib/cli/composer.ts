/**
 * Pure line handling for the terminal journal composer (scripts/write-entry.ts).
 *
 * Every line typed is journal text, except a line that is exactly one of the
 * slash commands below. Blank lines are kept — they separate paragraphs once
 * the text goes through `markdownToTiptap`.
 */

export type ComposerCommand = "save" | "cancel" | "undo" | "help";

const COMMANDS: Record<string, ComposerCommand> = {
  "/save": "save",
  "/s": "save",
  "/cancel": "cancel",
  "/quit": "cancel",
  "/q": "cancel",
  "/undo": "undo",
  "/help": "help",
};

/** The command a line represents, or null when it is ordinary text. */
export function parseComposerCommand(line: string): ComposerCommand | null {
  return COMMANDS[line.trim().toLowerCase()] ?? null;
}

/** Join the typed lines into the entry text; null when nothing was written. */
export function composeEntryText(lines: readonly string[]): string | null {
  const text = lines.join("\n").trim();
  return text.length > 0 ? text : null;
}

/** Drop the last non-blank line (and any blank lines after it). */
export function undoLastLine(lines: readonly string[]): string[] {
  const next = [...lines];
  while (next.length > 0 && next[next.length - 1].trim() === "") next.pop();
  next.pop();
  return next;
}

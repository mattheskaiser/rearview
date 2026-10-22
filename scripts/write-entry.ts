// Terminal journal composer: write today's entry without starting the web app.
//
// Usage:
//   npm run write                 # account from REARVIEW_CLI_EMAIL, the only one, or asked
//   npm run write -- --email you@example.com
//
// Goes through the same service layer as the web app (validation, hashing,
// one-entry-per-date, embeddings), so an entry written here is identical to
// one written in the editor. Journal text is never logged — it only lives in
// this terminal and the database.

import readline from "node:readline";

import {
  composeEntryText,
  parseComposerCommand,
  undoLastLine,
} from "@/lib/cli/composer";
import { syncEntryEmbeddings } from "@/lib/ai/entry-embeddings.service";
import { prisma } from "@/lib/db/client";
import { listUserAccounts, type UserAccount } from "@/lib/db/users";
import { env } from "@/lib/env";
import { markdownToTiptap } from "@/lib/editor/markdown-to-tiptap";
import { saveOrAppendJournalEntry } from "@/lib/journal-append.service";
import {
  hasJournalEntryOnDate,
  type SavedEntryForEmbedding,
} from "@/lib/journal.service";
import { formatJournalHeading } from "@/lib/time/journal-date";
import { zonedTodayString } from "@/lib/time/timezone";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

const HELP = dim(
  [
    "  Enter = new line · blank line = new paragraph · '- ' bullets · **bold** · *italic*",
    "  /save (or Ctrl+D) to save · /undo removes the last line · /cancel to quit",
  ].join("\n"),
);

async function askAccount(accounts: UserAccount[]): Promise<UserAccount> {
  accounts.forEach((a, i) => console.log(`  ${i + 1}) ${a.email}`));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => rl.question("  Which account? ", resolve));
  rl.close();
  const picked = accounts[Number(answer.trim()) - 1];
  if (!picked) throw new Error("No account picked.");
  console.log(dim("  Tip: set REARVIEW_CLI_EMAIL in .env to skip this question."));
  return picked;
}

async function pickUserId(email = env.REARVIEW_CLI_EMAIL): Promise<string> {
  const accounts = await listUserAccounts();
  if (email) {
    const match = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (!match) throw new Error(`No account with email "${email}".`);
    return match.id;
  }
  if (accounts.length === 1) return accounts[0].id;
  if (accounts.length === 0) throw new Error("No account exists yet — register in the web app first.");
  return (await askAccount(accounts)).id;
}

/** Collect lines until /save, Ctrl+D or /cancel. Resolves null when cancelled. */
function collectText(): Promise<string | null> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt(dim("  │ "));
  let lines: string[] = [];
  let armedDiscard = false;
  let settled = false;

  return new Promise((resolve) => {
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(value);
    };

    rl.on("line", (line) => {
      armedDiscard = false;
      const command = parseComposerCommand(line);
      if (command === "save") return finish(composeEntryText(lines));
      if (command === "cancel") return finish(null);
      if (command === "help") console.log(HELP);
      else if (command === "undo") {
        lines = undoLastLine(lines);
        console.log(dim(`  (removed — ${lines.length} line(s) left)`));
      } else lines.push(line);
      rl.prompt();
    });

    rl.on("SIGINT", () => {
      if (lines.length === 0 || armedDiscard) return finish(null);
      armedDiscard = true;
      console.log(dim("\n  Press Ctrl+C again to discard, or type /save."));
      rl.prompt();
    });

    // Ctrl+D / end of piped input saves what was written.
    rl.on("close", () => finish(composeEntryText(lines)));

    rl.prompt();
  });
}

async function indexForSearch(entry: SavedEntryForEmbedding): Promise<void> {
  process.stdout.write(dim("  Indexing for search… "));
  const result = await syncEntryEmbeddings({
    entryId: entry.id,
    contentText: entry.contentText,
    contentHash: entry.contentHash,
  }).catch(() => null);
  console.log(
    dim(
      result && result.status !== "failed"
        ? "done."
        : "skipped (Ollama unavailable) — it will catch up on your next search.",
    ),
  );
}

async function main(): Promise<void> {
  const emailFlag = process.argv.indexOf("--email");
  const userId = await pickUserId(emailFlag >= 0 ? process.argv[emailFlag + 1] : undefined);

  const today = zonedTodayString();
  const appending = await hasJournalEntryOnDate(userId, today);

  console.log(`\n  ${bold(formatJournalHeading(today))}`);
  if (appending) console.log(dim("  You already wrote today — this will be added to the end of that entry."));
  console.log(`${HELP}\n`);

  const text = await collectText();
  if (!text) {
    console.log(dim("\n  Nothing saved."));
    return;
  }

  let saved: SavedEntryForEmbedding | null = null;
  const result = await saveOrAppendJournalEntry(userId, today, markdownToTiptap(text), (entry) => {
    saved = entry;
  });
  if (!result.ok) {
    console.error(`\n  ✗ ${result.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n  ✓ ${result.mode === "created" ? "Entry saved" : "Added to today's entry"}.`);
  if (saved) await indexForSearch(saved);
}

main()
  .catch((error: unknown) => {
    // Error messages here never contain journal text (see services above).
    console.error(`\n  ✗ ${error instanceof Error ? error.message : "Something went wrong."}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

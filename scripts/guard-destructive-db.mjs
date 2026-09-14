#!/usr/bin/env node
// Explicit confirmation gate for destructive database commands (CLAUDE.md >
// Database, Git: "add clear development safeguards ... that make destructive
// operations explicit rather than easy to run accidentally").
//
// `db:migrate` (`prisma migrate dev`) and `db:deploy` (`prisma migrate
// deploy`) are unaffected -- neither wipes data. This guard exists for
// anything that can, e.g. `prisma migrate reset` or `prisma db push
// --force-reset`. Those aren't scripted today, but nothing stops someone
// (a person, or a future Claude Code session) from running one by hand
// against the wrong DATABASE_URL. This wrapper makes the target explicit
// before anything destructive runs, rather than adding a new easy-to-run
// script for it.
//
// Usage: node scripts/guard-destructive-db.mjs -- <command> [args...]
// Requires --yes-i-know-this-is-destructive somewhere in argv to proceed.

import { spawnSync } from "node:child_process";

const CONFIRM_FLAG = "--yes-i-know-this-is-destructive";

function describeTarget(url) {
  if (!url) return "(DATABASE_URL is not set)";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "(DATABASE_URL is not a valid URL)";
  }
}

const rawArgs = process.argv.slice(2);
const separator = rawArgs.indexOf("--");
if (separator === -1 || separator === rawArgs.length - 1) {
  console.error(
    "Usage: node scripts/guard-destructive-db.mjs -- <command> [args...] " +
      `[${CONFIRM_FLAG}]`,
  );
  process.exit(1);
}

const confirmed = rawArgs.includes(CONFIRM_FLAG);
const command = rawArgs
  .slice(separator + 1)
  .filter((arg) => arg !== CONFIRM_FLAG);

if (!confirmed) {
  console.error(
    [
      "",
      "  This command can permanently delete data:",
      `    ${command.join(" ")}`,
      "",
      `  Target database: ${describeTarget(process.env.DATABASE_URL)}`,
      "",
      `  Re-run with ${CONFIRM_FLAG} to proceed.`,
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);

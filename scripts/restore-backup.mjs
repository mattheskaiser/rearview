#!/usr/bin/env node
// Restores a manual Backup snapshot (lib/backup.service.ts) into a target
// database. See docs/backup-recovery.md for the full recovery procedure —
// this script only replays journal data; it does not create the account.
//
// Usage:
//   node scripts/restore-backup.mjs --target <DATABASE_URL> --user-email <email> [--content-file <path>] [--source <DATABASE_URL>] [--force]
//
// The snapshot content comes from one of:
//   --content-file <path>   a JSON file holding one Backup row's `content` column
//   --source <DATABASE_URL> read the user's most recent Backup row from this DB (read-only)
//
// Safety: refuses to write into a database that doesn't look like a test/local
// one (mirrors e2e/support/assert-test-db.ts) unless --force is passed. A real
// disaster-recovery restore into a fresh production database is exactly the
// case --force is for -- it's an explicit choice, not an accident.

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function assertSafeTarget(url, force) {
  if (force) return;
  const parsed = new URL(url);
  const host = parsed.hostname;
  const database = parsed.pathname.replace(/^\//, "");
  const looksLikeTestDb =
    LOOPBACK.has(host) || /test/i.test(host) || /test/i.test(database);
  if (!looksLikeTestDb) {
    throw new Error(
      `Refusing to restore into "${host}/${database}" -- it doesn't look like a ` +
        `test or local database. If this is deliberately a real recovery target ` +
        `(e.g. a fresh database after a disaster), re-run with --force.`,
    );
  }
}

function hashContentText(contentText) {
  return createHash("sha256").update(contentText, "utf8").digest("hex");
}

async function loadContent({ contentFile, source, userEmail }) {
  if (contentFile) {
    return JSON.parse(await readFile(contentFile, "utf8"));
  }
  if (!source) {
    throw new Error("Pass either --content-file or --source.");
  }

  const sourcePrisma = new PrismaClient({ datasources: { db: { url: source } } });
  try {
    const user = await sourcePrisma.user.findUnique({ where: { email: userEmail } });
    if (!user) throw new Error(`No user with email "${userEmail}" in the source database.`);

    const backup = await sourcePrisma.backup.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (!backup) throw new Error(`No backup rows found for "${userEmail}" in the source database.`);
    return backup.content;
  } finally {
    await sourcePrisma.$disconnect();
  }
}

/** Restore one snapshot's `content` into `targetUrl`, attaching rows to the
 * already-existing user with `userEmail`. Returns a summary for reporting. */
export async function restoreBackup({ targetUrl, content, userEmail, force = false }) {
  assertSafeTarget(targetUrl, force);

  const prisma = new PrismaClient({ datasources: { db: { url: targetUrl } } });
  try {
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      throw new Error(
        `No user with email "${userEmail}" exists in the target database. ` +
          `Register the account through the app first, then re-run this script -- ` +
          `it restores journal data, not accounts.`,
      );
    }

    const entryIdByDate = new Map();
    for (const entry of content.entries ?? []) {
      const journalDate = new Date(entry.journalDate);
      const written = await prisma.journalEntry.upsert({
        where: { userId_journalDate: { userId: user.id, journalDate } },
        create: {
          userId: user.id,
          journalDate,
          content: entry.content,
          contentText: entry.contentText,
          contentHash: hashContentText(entry.contentText),
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
        },
        update: {
          content: entry.content,
          contentText: entry.contentText,
          contentHash: hashContentText(entry.contentText),
          updatedAt: new Date(entry.updatedAt),
        },
      });
      entryIdByDate.set(entry.journalDate, written.id);
    }

    let restoredMemories = 0;
    for (const memory of content.memories ?? []) {
      const created = await prisma.memory.create({
        data: {
          userId: user.id,
          question: memory.question,
          answer: memory.answer,
          answerDoc: memory.answerDoc ?? undefined,
          createdAt: new Date(memory.createdAt),
        },
      });
      for (const date of memory.referencedDates ?? []) {
        await prisma.memoryEntry.create({
          data: {
            memoryId: created.id,
            entryId: entryIdByDate.get(date) ?? null,
            journalDate: new Date(date),
          },
        });
      }
      restoredMemories++;
    }

    if (content.currentGoals) {
      await prisma.currentGoals.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          content: content.currentGoals.content,
          text: content.currentGoals.text,
        },
        update: {
          content: content.currentGoals.content,
          text: content.currentGoals.text,
        },
      });
    }

    return {
      restoredEntries: entryIdByDate.size,
      restoredMemories,
      restoredGoals: Boolean(content.currentGoals),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.target || !args["user-email"]) {
    console.error(
      "Usage: node scripts/restore-backup.mjs --target <DATABASE_URL> --user-email <email> " +
        "(--content-file <path> | --source <DATABASE_URL>) [--force]",
    );
    process.exitCode = 1;
    return;
  }

  const content = await loadContent({
    contentFile: args["content-file"],
    source: args.source,
    userEmail: args["user-email"],
  });

  const summary = await restoreBackup({
    targetUrl: args.target,
    content,
    userEmail: args["user-email"],
    force: Boolean(args.force),
  });

  console.log(
    `Restored ${summary.restoredEntries} entries, ${summary.restoredMemories} memories` +
      `${summary.restoredGoals ? ", and current goals" : ""}.`,
  );
}

// Only run as a CLI when invoked directly, not when imported (e.g. by a test).
// Compared as file:// URLs (not raw path strings) so this works on Windows,
// where process.argv[1] uses backslashes and import.meta.url doesn't.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

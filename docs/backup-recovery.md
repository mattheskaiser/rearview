# Backup & recovery

Two layers protect your journal data. Know which one you're reaching for.

## Layer 1 — Neon point-in-time restore (the real disaster recovery)

Neon keeps continuous history of the dev database itself, separate from
anything in this repo. This is what you want after **"a bad migration or
`prisma` command wiped or corrupted the database."**

1. Open the Neon console for the project.
2. Use **Restore** (or branch-from-a-point-in-time) to a timestamp before the
   incident.
3. Point `DATABASE_URL`/`DIRECT_URL` at the restored branch, or promote it.

This is external to the app and isn't something this repo can script or test
in an automated way — treat the console as the source of truth for exact
steps, and prefer restoring to a *new* branch first so you can verify before
switching the app over to it.

## Layer 2 — the in-app manual "Back up now" snapshot

The Overview page's **Back up now** button (`lib/backup.service.ts`) snapshots
your journal entries, saved Memories, and Current Goals as one JSON row in
the `Backup` table — up to 5 most recent snapshots are kept per account.

**This lives in the same Postgres database as everything else.** It does not
protect you from the database itself being destroyed — Layer 1 does that.
What it protects against instead:

- Accidentally deleting or corrupting data *through the app* (not the DB).
- Wanting a portable, point-in-time export of your data you can move to a
  different database entirely — a fresh Neon project, a local Postgres, a new
  environment — independent of the original Neon project's continued
  existence.

**What's included:** journal entries (rich text + extracted plain text),
saved Memories (question, answer, cited dates), Current Goals.

**What's deliberately excluded:** embeddings (`EntryChunk.embedding` never
leaves the server — CLAUDE.md privacy rule — and are cheap to regenerate) and
auth data (`User`/`Session`/`Account` — restoring accounts is a separate
concern from restoring journal data).

**Encryption:** none beyond Neon's standard transport (TLS) and at-rest
handling — the same as your primary data, not less.

### Restoring a snapshot

`scripts/restore-backup.mjs` replays a `Backup.content` snapshot into a
target database. It only restores journal data — **create/register the
account on the target database first**, the same way you would any new
Rearview install, then run:

```bash
# Pull the latest snapshot directly from a source DB (read-only) and restore
# it into a target DB, both by full DATABASE_URL connection string:
node scripts/restore-backup.mjs \
  --target "postgresql://...target.../db" \
  --source "postgresql://...source.../db" \
  --user-email you@example.com

# Or restore from an exported JSON file (e.g. a `Backup.content` column you
# pulled out with psql) instead of connecting to a source DB:
node scripts/restore-backup.mjs \
  --target "postgresql://...target.../db" \
  --content-file ./my-backup.json \
  --user-email you@example.com
```

After restoring, ask a question on the Memories page (or wait for normal use)
— the opportunistic embedding backfill (`lib/ai/embedding-backfill.service.ts`)
re-embeds restored entries automatically; nothing manual is required.

**Safety guard:** the script refuses to write into a target whose host/database
name doesn't look like `localhost`/`test` unless you pass `--force` — the same
pattern `e2e/support/assert-test-db.ts` uses. A real recovery into a fresh
production database is exactly what `--force` is for; it's meant to be a
deliberate choice, not something a copy-pasted command does by accident.

### This has actually been tested

On 2026-09-14, a real backup snapshot (114 entries, 3 memories, current
goals) was pulled read-only from the dev database and restored into a fresh,
freshly-migrated, throwaway `pgvector/pgvector:pg17` Docker container —
never the dev database. Verified: entry/memory counts matched exactly, a
10-entry spot check of `contentText` matched byte-for-byte, current goals
restored correctly, and the target's `EntryChunk` table (correctly) had zero
rows with the `vector(1024)` column and HNSW index present and ready for a
fresh embed sync. The container was removed after the test; it isn't part of
the repo or CI.

To repeat this yourself:

```bash
docker run -d --name rearview-restore-test \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=rearview_restore_test -p 5434:5432 \
  pgvector/pgvector:pg17

DATABASE_URL="postgresql://postgres:postgres@localhost:5434/rearview_restore_test" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5434/rearview_restore_test" \
  npx prisma migrate deploy

# Register your account through the running app pointed at this DB, then:
node scripts/restore-backup.mjs \
  --target "postgresql://postgres:postgres@localhost:5434/rearview_restore_test" \
  --source "<your dev DATABASE_URL>" \
  --user-email you@example.com

docker rm -f rearview-restore-test   # when done
```

## Destructive Prisma commands

No script in `package.json` runs a destructive command today (`db:migrate` is
`prisma migrate dev`, `db:deploy` is `prisma migrate deploy` — neither wipes
data). If you ever need `prisma migrate reset` or `prisma db push
--force-reset`, use the guarded wrapper instead of the raw command:

```bash
npm run db:reset:guarded                                  # refuses, prints the target DB
npm run db:reset:guarded -- --yes-i-know-this-is-destructive   # actually runs it
```

It prints the target database (host + name) and refuses to proceed without
that explicit flag, so a mistargeted `DATABASE_URL` fails loudly instead of
silently wiping the wrong database.

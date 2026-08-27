# E2E test database — one-time setup

The E2E suite (`npm run test:e2e`) must **never** touch the dev Neon branch. It
runs against a throwaway PostgreSQL with the `vector` extension, configured
through `.env.test` (git-ignored). `e2e/seed/*` and `e2e/support/assert-test-db.ts`
refuse to run unless `DATABASE_URL`'s host is loopback or its host/db name
contains `test`.

## Option A — local `pgvector` container (recommended)

```bash
docker run -d --name rearview-test-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=rearview_test \
  -p 5433:5432 \
  pgvector/pgvector:pg17
```

Create `.env.test` at the repo root (git-ignored). It needs the same keys as
`.env` — copy the `BETTER_AUTH_SECRET` (any ≥32-char value), `OLLAMA_*` and
`EMBEDDING_*` lines across, and set the database URLs to the local container:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/rearview_test"
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/rearview_test"
BETTER_AUTH_SECRET="rearview-e2e-test-secret-key-0000000000000000"
BETTER_AUTH_URL="http://localhost:3100"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_GENERATION_MODEL="llama3.1"
EMBEDDING_MODEL="bge-m3"
EMBEDDING_DIMENSIONS="1024"
```

Nothing else to do — `global-setup` runs `prisma migrate deploy` against it on
every run, which creates the schema, the `vector` extension and the HNSW index,
and asserts the index exists before seeding.

Stop / remove it with `docker stop rearview-test-db` / `docker rm rearview-test-db`.
The data is disposable; `global-teardown` wipes the seeded corpus after each run
(unless `KEEP_TEST_DATA=1`).

## Option B — a dedicated Neon branch

1. In the Neon console, create a branch of the project (e.g. `e2e-test`) — a
   separate compute + database, not the dev branch.
2. Put its pooled and direct connection strings in `.env.test` as `DATABASE_URL`
   and `DIRECT_URL`. The database name must contain `test` (Neon branch DBs are
   usually `neondb`; rename or create a `..._test` database on the branch) so the
   guard in `assert-test-db.ts` allows it.
3. `global-setup` migrates it like Option A.

Never point `.env.test` at the dev branch host `ep-rough-base-arybd6nc*` — the
guard will abort, but don't rely on that.

## Requirements for a run

- The local **Ollama** must be running with both models pulled:
  `ollama pull bge-m3 && ollama pull llama3.1`. `global-setup` checks this and
  fails the run with a clear message if either is missing.
- Ports **3100** (app) and **3101** (the `ollama-down` project's app instance)
  must be free. The web servers run `next build` once, then `next start`.

## Running

```bash
npm run test:e2e              # full suite (chromium + ollama-down projects)
npm run test:e2e:chromium     # skip the ollama-down project
KEEP_TEST_DATA=1 npm run test:e2e   # leave the seeded corpus in the test DB
npm run test:e2e:report       # open the last HTML report
```

Artifacts land in `e2e/artifacts/` (git-ignored):
`reflection-transcript.json` (every Q/A/evidence tuple), the HTML report, traces.

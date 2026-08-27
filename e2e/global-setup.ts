import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { request, type FullConfig } from "@playwright/test";

// `playwright.config.ts` calls `loadTestEnv()` at load time, so `process.env` is
// already populated before the `@/lib/*` imports below evaluate `lib/env.ts`.
import { checkOllamaHealth } from "@/lib/ai/ollama-health.service";
import { prisma } from "@/lib/db/client";

import { CORPUS } from "./fixtures/corpus";
import { STORAGE_STATE_PATH, TEST_ACCOUNT } from "./fixtures/test-account";
import { resetTestData } from "./seed/reset";
import { countUnembeddedChunks, seedCorpus } from "./seed/seed";
import { assertTestDatabase } from "./support/assert-test-db";

const EMBED_TIMEOUT_MS = 5 * 60 * 1000;
const HNSW_INDEX = "EntryChunk_embedding_hnsw_idx";

export default async function globalSetup(config: FullConfig): Promise<void> {
  assertTestDatabase();
  mkdirSync("e2e/artifacts", { recursive: true });
  writeFileSync("e2e/artifacts/reflection-transcript.json", "[]\n");

  // 1. Ollama must be reachable with both configured models pulled.
  const health = await checkOllamaHealth();
  if (!health.reachable || !health.embedding.available || !health.generation.available) {
    throw new Error(
      "[e2e] Ollama is not ready. Start it and pull the models:\n" +
        `  reachable: ${health.reachable}\n` +
        `  ${health.embedding.model}: ${health.embedding.available}\n` +
        `  ${health.generation.model}: ${health.generation.available}\n` +
        "Run: ollama serve  &&  ollama pull bge-m3  &&  ollama pull llama3.1",
    );
  }
  await warmUpGenerationModel();

  // 2. Migrate the test database and confirm the pgvector index exists.
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE indexname = ${HNSW_INDEX}
  `;
  if (indexes.length === 0) {
    throw new Error(
      `[e2e] pgvector HNSW index "${HNSW_INDEX}" is missing on the test database — ` +
        "vector search would return nothing. Check the migrations applied.",
    );
  }

  // 3. Register (or reuse) the single account and save its browser state.
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3100";
  const api = await request.newContext({ baseURL });
  const signUp = await api.post("/api/auth/sign-up/email", {
    data: {
      name: TEST_ACCOUNT.name,
      email: TEST_ACCOUNT.email,
      password: TEST_ACCOUNT.password,
    },
  });
  if (!signUp.ok()) {
    // Account already exists from a KEEP_TEST_DATA run — sign in instead.
    const signIn = await api.post("/api/auth/sign-in/email", {
      data: { email: TEST_ACCOUNT.email, password: TEST_ACCOUNT.password },
    });
    if (!signIn.ok()) {
      throw new Error(
        `[e2e] could not register or sign in the test account: ` +
          `${signUp.status()} / ${signIn.status()}`,
      );
    }
  }
  await api.storageState({ path: STORAGE_STATE_PATH });
  await api.dispose();

  // 4. Seed the corpus for that account, then wait for every chunk to embed.
  const user = await prisma.user.findFirstOrThrow({
    where: { email: TEST_ACCOUNT.email },
    select: { id: true },
  });
  await resetTestData();

  const startedAt = Date.now();
  process.stdout.write(`[e2e] seeding ${CORPUS.length} entries + embeddings…\n`);
  await seedCorpus(user.id);

  await waitForEmbeddings(startedAt);
  process.stdout.write(
    `[e2e] corpus ready in ${Math.round((Date.now() - startedAt) / 1000)}s\n`,
  );
  await prisma.$disconnect();
}

/**
 * Load llama3.1 into memory before the specs run. The app's Ollama client caps a
 * generation at 60s, which a cold 8B load can exceed on the first call — every
 * subsequent call is fast while the model stays resident. `keep_alive: -1` keeps
 * it loaded for the whole run.
 */
async function warmUpGenerationModel(): Promise<void> {
  const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_GENERATION_MODEL ?? "llama3.1";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240_000);
  try {
    process.stdout.write(`[e2e] warming up ${model}…\n`);
    const res = await fetch(new URL("/api/generate", base), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, prompt: "ready?", stream: false, keep_alive: -1 }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`warmup returned ${res.status}`);
    await res.json();
  } catch (error) {
    throw new Error(
      `[e2e] could not warm up ${model}: ${error instanceof Error ? error.message : error}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function waitForEmbeddings(startedAt: number): Promise<void> {
  while (Date.now() - startedAt < EMBED_TIMEOUT_MS) {
    const pending = await countUnembeddedChunks();
    if (pending === 0) return;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  const pending = await countUnembeddedChunks();
  throw new Error(
    `[e2e] embeddings did not finish within ${EMBED_TIMEOUT_MS / 1000}s ` +
      `(${pending} chunks still unembedded).`,
  );
}

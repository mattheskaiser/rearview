import "server-only";

import { z } from "zod";

/**
 * Server-only environment contract.
 *
 * Every value Rearview needs from the environment is parsed and validated here
 * once, then imported as the typed `env` object everywhere else. Nothing in the
 * app should read `process.env` directly.
 *
 * CLAUDE.md: Ollama model names are configuration — they live here and are
 * never hardcoded elsewhere. DB credentials never reach the client; the
 * "server-only" import above makes importing this file from a Client Component
 * a build error.
 */
const envSchema = z.object({
  // Neon PostgreSQL — pooled connection, used by the app at runtime.
  DATABASE_URL: z.string().min(1),
  // Neon PostgreSQL — direct connection, used by Prisma migrations.
  DIRECT_URL: z.string().min(1),

  // Better Auth — session signing secret. Generate with `openssl rand -base64 32`.
  // Never committed; required in every environment.
  BETTER_AUTH_SECRET: z.string().min(32),
  // Canonical origin the app is served from. Drives cookie security (an https
  // value turns on Secure cookies) and CSRF trusted origins.
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  // Registration is closed once the first account exists. Set to "true" only to
  // deliberately re-open sign-up (e.g. to add a second account).
  AUTH_ALLOW_REGISTRATION: z
    .string()
    .optional()
    .transform((value) => value === "true"),

  // Name used in the Overview greeting. Optional — the greeting falls back to a
  // plain "Hello" when unset. Configuration, not example content.
  REARVIEW_USER_NAME: z.string().trim().min(1).optional(),

  // Ollama — local, server side only. All AI (generation + embeddings) runs
  // through this one base URL; journal content never leaves it.
  OLLAMA_BASE_URL: z.url().default("http://localhost:11434"),
  // Text-generation model used for synthesis. Must understand German, English
  // and Spanish (see docs/AI notes). Configuration, never hardcoded.
  OLLAMA_GENERATION_MODEL: z.string().min(1),
  // Embedding model. `bge-m3` — multilingual, 1024-dimensional. Swapping this
  // for a model with a different dimensionality requires a matching
  // `EMBEDDING_DIMENSIONS` value, a schema migration for the `vector(N)` column,
  // and a full re-embed of every chunk.
  EMBEDDING_MODEL: z.string().min(1),
  // Dimensionality the embedding model emits. Verified against every vector
  // Ollama returns before it can reach the `vector(N)` column, so a mismatch
  // fails loudly instead of corrupting storage. Must equal the schema's
  // `vector(N)`.
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Report which keys are wrong — never their values.
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Fix these keys in your .env:\n${issues}`,
    );
  }

  return parsed.data;
}

export const env: Env = loadEnv();

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

  // Name used in the Overview greeting. Optional — the greeting falls back to a
  // plain "Hello" when unset. Configuration, not example content.
  REARVIEW_USER_NAME: z.string().trim().min(1).optional(),

  // Ollama — local, server side only.
  OLLAMA_BASE_URL: z.url().default("http://localhost:11434"),
  OLLAMA_GENERATION_MODEL: z.string().min(1),
  OLLAMA_EMBEDDING_MODEL: z.string().min(1),
  OLLAMA_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive(),
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

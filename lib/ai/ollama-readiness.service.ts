import "server-only";

import { syncPendingEmbeddingsForUser } from "@/lib/ai/embedding-backfill.service";
import { checkOllamaHealth, type OllamaHealth } from "@/lib/ai/ollama-health.service";

/**
 * Pre-flight check for the reflection flow (CLAUDE.md > AI: "what happens
 * when Ollama is unavailable" / "when the selected model is unavailable"
 * must be distinguishable). Without this, both cases previously surfaced as
 * the same generic failure — a missing model only after a full retrieval
 * attempt and, for generation, a 60-second stall.
 *
 * Also opportunistically retries any of the user's entries whose embeddings
 * never completed (e.g. saved while Ollama was down) — best-effort, never
 * blocks the readiness check itself. See lib/ai/embedding-backfill.service.
 */

export const OLLAMA_DOWN_MESSAGE =
  "The local AI model is not reachable right now. Your journal is unaffected — start Ollama and try again.";

function modelNotFoundMessage(model: string): string {
  return `The "${model}" model isn't pulled in Ollama. Run \`ollama pull ${model}\` and try again.`;
}

function describeUnhealthy(
  health: OllamaHealth,
  need: "embedding" | "generation",
): string | null {
  if (!health.reachable) return OLLAMA_DOWN_MESSAGE;
  if (!health.embedding.available) {
    return modelNotFoundMessage(health.embedding.model);
  }
  if (need === "generation" && !health.generation.available) {
    return modelNotFoundMessage(health.generation.model);
  }
  return null;
}

/**
 * Null when ready to proceed; otherwise a specific, user-facing reason.
 * `need` narrows which model must be pulled: evidence-only retrieval only
 * needs the embedding model, a full reflection needs both.
 */
export async function ensureOllamaReady(
  userId: string,
  need: "embedding" | "generation",
): Promise<string | null> {
  const health = await checkOllamaHealth();
  const problem = describeUnhealthy(health, need);
  if (problem) return problem;

  await syncPendingEmbeddingsForUser(userId).catch(() => {
    // Best-effort self-heal; a failure here must not block the actual query.
  });
  return null;
}

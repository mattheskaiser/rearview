import "server-only";

import {
  ANSWER_SYSTEM_PROMPT,
  buildAnswerPrompt,
  type PromptEvidence,
} from "@/lib/ai/answer-prompt";
import {
  OllamaError,
  OllamaUnavailableError,
  generate,
} from "@/lib/ai/ollama.service";

/**
 * AI answer capability (CLAUDE.md > AI). Turns retrieved journal evidence into
 * a grounded synthesis. The prompt and evidence never reach a log. A missing or
 * unreachable Ollama is reported as a typed reason — never thrown at the caller,
 * so journal features keep working when inference is down.
 */

export type AnswerFailureReason =
  | "no-evidence"
  | "ollama-unavailable"
  | "generation-failed";

export type AnswerResult =
  | { ok: true; answer: string }
  | { ok: false; reason: AnswerFailureReason };

/** Low temperature keeps the synthesis close to the evidence. */
const GENERATION_TEMPERATURE = 0.2;

export async function generateAnswer(
  question: string,
  evidence: PromptEvidence[],
): Promise<AnswerResult> {
  if (evidence.length === 0) return { ok: false, reason: "no-evidence" };

  try {
    const raw = await generate(buildAnswerPrompt(question, evidence), {
      system: ANSWER_SYSTEM_PROMPT,
      temperature: GENERATION_TEMPERATURE,
    });
    const answer = raw.trim();
    if (!answer) return { ok: false, reason: "generation-failed" };
    return { ok: true, answer };
  } catch (error) {
    if (error instanceof OllamaUnavailableError) {
      return { ok: false, reason: "ollama-unavailable" };
    }
    if (error instanceof OllamaError) {
      return { ok: false, reason: "generation-failed" };
    }
    throw error;
  }
}

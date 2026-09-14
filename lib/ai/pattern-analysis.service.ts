import "server-only";

import {
  parsePatternResponse,
  type PatternAnalysisResult,
} from "@/lib/ai/parse-pattern-response";
import {
  buildExtractionPrompt,
  buildPatternPrompt,
  buildPatternSystemPrompt,
  type PatternEvidence,
} from "@/lib/ai/pattern-prompt";
import { generateCollected } from "@/lib/ai/generate-collected";
import { ensureOllamaReady, OLLAMA_DOWN_MESSAGE } from "@/lib/ai/ollama-readiness.service";
import { OllamaUnavailableError } from "@/lib/ai/ollama.service";
import { retrieveBroad } from "@/lib/retrieval-broad.service";

/**
 * Orchestrates the "find patterns" flow: broad retrieval across the user's
 * whole journal history, then synthesis (CLAUDE.md > Retrieval, AI). Grounded
 * question-answering already exists (lib/reflection.service); this is a
 * separate, explicit mode rather than the same one made to guess intent —
 * the two need different retrieval shapes and a different prompt, and an
 * explicit toggle can't misclassify.
 *
 * A single request is bounded by SINGLE_PASS_CHAR_BUDGET regardless of how
 * much history exists: past that, evidence is map-reduced — a cheap
 * extraction pass per batch, then one final synthesis over the (much
 * smaller) extracted candidates — rather than growing one prompt without
 * bound as a backfilled journal grows.
 */

const SINGLE_PASS_CHAR_BUDGET = 12_000;
const BATCH_CHAR_BUDGET = 4_000;
/** Low temperature: faithful synthesis over the evidence, not creative writing. */
const GENERATION_TEMPERATURE = 0.2;
const GENERIC_ERROR = "Something went wrong. Please try again.";
const NO_EVIDENCE_ERROR =
  "No journal entries seem related to that yet. Try rephrasing, or write more entries.";

export type PatternAnalysisOutcome =
  | {
      ok: true;
      question: string;
      result: PatternAnalysisResult;
      entryDates: string[];
    }
  | { ok: false; error: string };

function toEvidence(
  chunks: { journalDate: string; text: string }[],
): PatternEvidence[] {
  return chunks.map((chunk) => ({
    journalDate: chunk.journalDate,
    text: chunk.text,
  }));
}

/** Greedily pack evidence into batches, each under `budget` characters. */
function batchByBudget(
  evidence: PatternEvidence[],
  budget: number,
): PatternEvidence[][] {
  const batches: PatternEvidence[][] = [];
  let current: PatternEvidence[] = [];
  let currentLength = 0;

  for (const item of evidence) {
    if (current.length > 0 && currentLength + item.text.length > budget) {
      batches.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(item);
    currentLength += item.text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** Map stage: compress each batch into one dated candidate-observations summary. */
async function extractCandidates(
  batches: PatternEvidence[][],
  systemPrompt: string,
): Promise<PatternEvidence[]> {
  const summaries: PatternEvidence[] = [];
  for (const batch of batches) {
    const from = batch[0].journalDate;
    const to = batch[batch.length - 1].journalDate;
    const text = await generateCollected(buildExtractionPrompt(batch), {
      system: systemPrompt,
      temperature: GENERATION_TEMPERATURE,
    });
    summaries.push({
      journalDate: from === to ? from : `${from} to ${to}`,
      text,
    });
  }
  return summaries;
}

export async function runPatternAnalysis(
  userId: string,
  question: string,
  userName?: string,
): Promise<PatternAnalysisOutcome> {
  const problem = await ensureOllamaReady(userId, "generation");
  if (problem) return { ok: false, error: problem };

  const { chunks, entryDates } = await retrieveBroad(userId, question);
  if (chunks.length === 0) return { ok: false, error: NO_EVIDENCE_ERROR };

  const evidence = toEvidence(chunks);
  const totalChars = evidence.reduce((sum, item) => sum + item.text.length, 0);
  const validDates = new Set(entryDates);
  const systemPrompt = buildPatternSystemPrompt(userName);

  try {
    const finalEvidence =
      totalChars > SINGLE_PASS_CHAR_BUDGET
        ? await extractCandidates(batchByBudget(evidence, BATCH_CHAR_BUDGET), systemPrompt)
        : evidence;

    const raw = await generateCollected(buildPatternPrompt(question, finalEvidence), {
      system: systemPrompt,
      temperature: GENERATION_TEMPERATURE,
    });

    return {
      ok: true,
      question,
      result: parsePatternResponse(raw, validDates),
      entryDates,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof OllamaUnavailableError ? OLLAMA_DOWN_MESSAGE : GENERIC_ERROR,
    };
  }
}

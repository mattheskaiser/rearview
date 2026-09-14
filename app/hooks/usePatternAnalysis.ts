"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import {
  patternAnalysisAction,
  saveMemoryAction,
} from "@/app/(app)/memories/actions";
import {
  collectPatternDates,
  formatPatternResultAsMarkdown,
} from "@/lib/ai/format-pattern-result";
import type { PatternAnalysisResult } from "@/lib/ai/parse-pattern-response";

/**
 * Client state for "Find patterns" mode. Unlike `useReflectionStream`, this
 * is one request/response, not a token stream: map-reduce synthesis takes
 * longer than a single answer, and the result is structured (observations +
 * counterexamples + confidence + follow-ups), not free text to stream.
 */

type Phase = "idle" | "loading" | "done" | "error";
type Status = { tone: "success" | "error"; text: string } | null;

export function usePatternAnalysis() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<PatternAnalysisResult | null>(null);
  const [entryDates, setEntryDates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Status>(null);

  const ask = useCallback(async (q: string) => {
    setQuestion(q);
    setPhase("loading");
    setError(null);
    setResult(null);
    setEntryDates([]);
    setSaveStatus(null);

    const outcome = await patternAnalysisAction(q);
    if (outcome.ok) {
      setResult(outcome.result);
      setEntryDates(outcome.entryDates);
      setPhase("done");
    } else {
      setError(outcome.error);
      setPhase("error");
    }
  }, []);

  const save = useCallback(async () => {
    if (!result || result.observations.length === 0) return;
    setSaving(true);
    setSaveStatus(null);

    const outcome = await saveMemoryAction({
      question,
      answer: formatPatternResultAsMarkdown(result),
      dates: collectPatternDates(result),
    });
    setSaving(false);
    if (outcome.ok) {
      setSaveStatus({ tone: "success", text: "Saved to your memories." });
      router.refresh();
    } else {
      setSaveStatus({ tone: "error", text: outcome.error });
    }
  }, [result, question, router]);

  return {
    phase,
    loading: phase === "loading",
    question,
    result,
    entryDates,
    error,
    saving,
    saveStatus,
    canSave: phase === "done" && (result?.observations.length ?? 0) > 0,
    ask,
    save,
  };
}

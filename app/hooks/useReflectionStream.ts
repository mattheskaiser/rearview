"use client";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import {
  retrieveEvidenceAction,
  saveMemoryAction,
} from "@/app/(app)/memories/actions";
import { readReflectionStream } from "@/app/hooks/read-reflection-stream";
import type { EvidenceCard } from "@/lib/types/memory";

/**
 * Client state for the retrieval-first reflection flow: submit -> evidence
 * cards -> streamed answer -> save / stop / show more. Retrieval and generation
 * run server-side; this hook tracks phase and accumulates the token feed.
 */

const START_LIMIT = 6;
const LIMIT_STEP = 6;
const MAX_LIMIT = 15;

export type ReflectionPhase =
  | "idle"
  | "retrieving"
  | "streaming"
  | "done"
  | "stopped"
  | "error";

type Status = { tone: "success" | "error"; text: string } | null;

export function useReflectionStream() {
  const router = useRouter();
  const [phase, setPhase] = useState<ReflectionPhase>("idle");
  const [question, setQuestion] = useState("");
  const [evidence, setEvidence] = useState<EvidenceCard[]>([]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Status>(null);
  const [saving, setSaving] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [limit, setLimit] = useState(START_LIMIT);

  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (q: string, limit: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setQuestion(q);
    setError(null);
    setSaveStatus(null);
    setAnswer("");
    setEvidence([]);
    setPhase("retrieving");

    try {
      for await (const event of readReflectionStream(q, limit, controller.signal)) {
        if (controller.signal.aborted) return;
        if (event.type === "evidence") {
          setEvidence(event.evidence);
          setPhase("streaming");
        } else if (event.type === "token") {
          setAnswer((prev) => prev + event.value);
        } else if (event.type === "done") {
          setPhase("done");
        } else {
          setError(event.error);
          setPhase("error");
        }
      }
    } catch {
      if (controller.signal.aborted) return;
      setError("The connection to the local AI dropped. Please try again.");
      setPhase("error");
      return;
    }

    setPhase((prev) =>
      prev === "streaming" || prev === "retrieving" ? "done" : prev,
    );
  }, []);

  const ask = useCallback(
    (q: string) => {
      setLimit(START_LIMIT);
      void run(q, START_LIMIT);
    },
    [run],
  );

  const regenerate = useCallback(() => {
    if (question) void run(question, limit);
  }, [run, question, limit]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setPhase((prev) => (prev === "streaming" ? "stopped" : prev));
  }, []);

  const showMore = useCallback(async () => {
    if (!question || limit >= MAX_LIMIT) return;
    const next = Math.min(MAX_LIMIT, limit + LIMIT_STEP);
    setMoreLoading(true);
    const result = await retrieveEvidenceAction(question, next);
    setMoreLoading(false);
    if (result.ok) {
      setLimit(next);
      setEvidence(result.evidence);
    } else {
      setSaveStatus({ tone: "error", text: result.error });
    }
  }, [question, limit]);

  const save = useCallback(async () => {
    if (!answer.trim() || evidence.length === 0) return;
    setSaving(true);
    setSaveStatus(null);
    const result = await saveMemoryAction({
      question,
      answer: answer.trim(),
      dates: evidence.map((item) => item.date),
    });
    setSaving(false);
    if (result.ok) {
      setSaveStatus({ tone: "success", text: "Saved to your memories." });
      router.refresh();
    } else {
      setSaveStatus({ tone: "error", text: result.error });
    }
  }, [answer, evidence, question, router]);

  const settled = phase === "done" || phase === "stopped" || phase === "error";

  return {
    phase,
    question,
    evidence,
    answer,
    error,
    saveStatus,
    saving,
    moreLoading,
    streaming: phase === "retrieving" || phase === "streaming",
    canStop: phase === "streaming",
    canSave: settled && answer.trim().length > 0,
    canShowMore: settled && evidence.length > 0 && limit < MAX_LIMIT,
    canRegenerate: settled && question.length > 0,
    ask,
    stop,
    showMore,
    regenerate,
    save,
  };
}

"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { askAction, saveMemoryAction } from "@/app/(app)/memories/actions";
import type { Reflection } from "@/lib/types/memory";

type Status = { tone: "success" | "error"; text: string } | null;

/**
 * Client state for the ask -> answer -> save-as-Memory flow. Every retrieval,
 * generation and persistence step runs server-side in the actions; this hook
 * only tracks UI status.
 */
export function useReflection() {
  const router = useRouter();
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Status>(null);
  const [asking, startAsking] = useTransition();
  const [saving, startSaving] = useTransition();

  const ask = useCallback((question: string) => {
    setError(null);
    setSaveStatus(null);
    setReflection(null);
    startAsking(async () => {
      const result = await askAction(question);
      if (result.ok) setReflection(result.reflection);
      else setError(result.error);
    });
  }, []);

  const save = useCallback(() => {
    if (!reflection) return;
    setSaveStatus(null);
    startSaving(async () => {
      const result = await saveMemoryAction({
        question: reflection.question,
        answer: reflection.answer,
        dates: reflection.evidence.map((item) => item.date),
      });
      if (result.ok) {
        setSaveStatus({ tone: "success", text: "Saved to your memories." });
        router.refresh();
      } else {
        setSaveStatus({ tone: "error", text: result.error });
      }
    });
  }, [reflection, router]);

  return { reflection, error, saveStatus, asking, saving, ask, save };
}

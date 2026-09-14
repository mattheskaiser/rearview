"use client";
import { useState } from "react";

import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { QueryModeToggle, type QueryMode } from "@/app/components/molecules/QueryModeToggle.molecule";
import { QuestionInput } from "@/app/components/molecules/QuestionInput.molecule";
import { AnswerPanel } from "@/app/components/organisms/AnswerPanel.organism";
import { EvidenceCards } from "@/app/components/organisms/EvidenceCards.organism";
import { PatternResults } from "@/app/components/organisms/PatternResults.organism";
import { useReflection } from "@/app/hooks/reflection-context";
import { usePatternAnalysis } from "@/app/hooks/usePatternAnalysis";

/**
 * Ask the journal a question, or switch to "Find patterns" for a broader
 * synthesis across the whole journal. "Ask" retrieves and streams a single
 * grounded answer; "Find patterns" runs a separate, explicit retrieval +
 * synthesis pipeline (lib/ai/pattern-analysis.service) and returns a
 * structured result once ready rather than streaming tokens.
 */
export const ReflectionPanel = () => {
  const [mode, setMode] = useState<QueryMode>("ask");
  const r = useReflection();
  const p = usePatternAnalysis();

  const showAskPanel = r.evidence.length > 0 || r.answer.length > 0 || r.streaming;
  const showPatternPanel = p.phase !== "idle";

  return (
    <section className="flex flex-col gap-4">
      <QueryModeToggle mode={mode} onChange={setMode} />

      <QuestionInput
        onAsk={mode === "ask" ? r.ask : p.ask}
        pending={mode === "ask" ? r.streaming : p.loading}
      />

      {mode === "ask" ? (
        <>
          {r.error && !showAskPanel ? (
            <FormMessage tone="error">{r.error}</FormMessage>
          ) : null}

          {showAskPanel ? (
            <div className="flex flex-col gap-4">
              <AnswerPanel
                answer={r.answer}
                answerDoc={r.answerDoc}
                phase={r.phase}
                error={r.error}
                canStop={r.canStop}
                canSave={r.canSave}
                canRegenerate={r.canRegenerate}
                saving={r.saving}
                onStop={r.stop}
                onSave={r.save}
                onRegenerate={r.regenerate}
              />
              {r.saveStatus ? (
                <FormMessage tone={r.saveStatus.tone}>
                  {r.saveStatus.text}
                </FormMessage>
              ) : null}
              <EvidenceCards
                evidence={r.evidence}
                onShowMore={r.showMore}
                canShowMore={r.canShowMore}
                loadingMore={r.moreLoading}
              />
            </div>
          ) : null}
        </>
      ) : showPatternPanel ? (
        <PatternResults
          loading={p.loading}
          result={p.result}
          error={p.error}
          canSave={p.canSave}
          saving={p.saving}
          saveStatus={p.saveStatus}
          onSave={p.save}
        />
      ) : null}
    </section>
  );
};

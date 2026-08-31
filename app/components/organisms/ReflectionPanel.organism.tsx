"use client";
import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { QuestionInput } from "@/app/components/molecules/QuestionInput.molecule";
import { AnswerPanel } from "@/app/components/organisms/AnswerPanel.organism";
import { EvidenceCards } from "@/app/components/organisms/EvidenceCards.organism";
import { useReflection } from "@/app/hooks/reflection-context";

/**
 * Ask the journal a question. Retrieval runs first and its entries render as
 * cards; the AI answer then streams in below, with a Stop button. Evidence
 * points back to the authoritative journal entries.
 */
export const ReflectionPanel = () => {
  const r = useReflection();
  const showPanel = r.evidence.length > 0 || r.answer.length > 0 || r.streaming;

  return (
    <section className="flex flex-col gap-4">
      <QuestionInput onAsk={r.ask} pending={r.streaming} />

      {r.error && !showPanel ? (
        <FormMessage tone="error">{r.error}</FormMessage>
      ) : null}

      {showPanel ? (
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
    </section>
  );
};

"use client";
import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { Spinner } from "@/app/components/atoms/Spinner.atom";
import { AnswerPanel } from "@/app/components/organisms/AnswerPanel.organism";
import { EvidenceList } from "@/app/components/organisms/EvidenceList.organism";
import { QuestionInput } from "@/app/components/molecules/QuestionInput.molecule";
import { useReflection } from "@/app/hooks/useReflection";

/**
 * Ask the journal a question and, optionally, keep the answer as a Memory. The
 * answer is explicitly AI-generated; the evidence chips point back to the
 * authoritative journal entries.
 */
export const ReflectionPanel = () => {
  const { reflection, error, saveStatus, asking, saving, ask, save } =
    useReflection();

  return (
    <section className="flex flex-col gap-4">
      <QuestionInput onAsk={ask} pending={asking} />

      {asking ? <Spinner /> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {reflection ? (
        <div className="flex flex-col gap-4">
          <AnswerPanel
            answer={reflection.answer}
            onSaveAsMemory={save}
            saving={saving}
          />
          {saveStatus ? (
            <FormMessage tone={saveStatus.tone}>{saveStatus.text}</FormMessage>
          ) : null}
          <EvidenceList evidence={reflection.evidence} />
        </div>
      ) : null}
    </section>
  );
};

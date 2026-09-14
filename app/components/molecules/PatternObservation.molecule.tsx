import { Badge } from "@/app/components/atoms/Badge.atom";
import { EvidenceChip } from "@/app/components/molecules/EvidenceChip.molecule";
import { formatJournalDateLabel } from "@/lib/time/journal-date";
import type { PatternObservation as PatternObservationData } from "@/lib/ai/parse-pattern-response";

const CONFIDENCE_LABEL: Record<PatternObservationData["confidence"], string> = {
  strong: "Strong evidence",
  limited: "Limited evidence",
  "single-instance": "Single instance",
};

/**
 * One observation from "Find patterns" mode: the claim, why the model thinks
 * it's a pattern, the journal dates that actually support it (clickable, same
 * as single-question evidence), any counterexample, and a confidence badge —
 * so a claim is never presented without a way to check it against the source.
 */
export const PatternObservation = ({
  observation,
  why,
  supportingDates,
  counterexamples,
  confidence,
}: PatternObservationData) => {
  return (
    <article className="rounded-lg border border-border bg-secondary/25 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{observation}</p>
        <Badge variant="accent">{CONFIDENCE_LABEL[confidence]}</Badge>
      </div>
      {why ? (
        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{why}</p>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {supportingDates.map((date) => (
          <EvidenceChip key={date} date={date} label={formatJournalDateLabel(date)} />
        ))}
      </div>
      {counterexamples ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Counterexample: </span>
          {counterexamples}
        </p>
      ) : null}
    </article>
  );
};

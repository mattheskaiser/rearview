import { SourceChip } from "@/app/components/atoms/SourceChip.atom";
import { Button } from "@/components/ui/button";
import type { EvidenceCard as EvidenceCardData } from "@/lib/types/memory";

type EvidenceCardsProps = {
  evidence: EvidenceCardData[];
  onShowMore: () => void;
  canShowMore: boolean;
  loadingMore: boolean;
};

/**
 * Which journal entries informed an answer — just the dates, as small links,
 * not a preview of their text. The answer itself quotes the relevant phrases
 * inline, so this is just a "sources" strip for cross-checking, not a second
 * copy of the journal content. "Show more entries" pulls a wider set (a
 * larger retrieval limit) without re-triggering the answer.
 */
export const EvidenceCards = ({
  evidence,
  onShowMore,
  canShowMore,
  loadingMore,
}: EvidenceCardsProps) => {
  if (evidence.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Journal entries">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
        From your journal
      </h3>
      <div className="flex flex-wrap gap-2">
        {evidence.map((item) => (
          <SourceChip key={item.date} date={item.date} label={item.label} />
        ))}
      </div>
      {canShowMore ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={onShowMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Show more entries"}
          </Button>
        </div>
      ) : null}
    </section>
  );
};

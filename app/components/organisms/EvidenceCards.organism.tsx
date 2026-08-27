import { EvidenceCard } from "@/app/components/molecules/EvidenceCard.molecule";
import { Button } from "@/components/ui/button";
import type { EvidenceCard as EvidenceCardData } from "@/lib/types/memory";

type EvidenceCardsProps = {
  evidence: EvidenceCardData[];
  onShowMore: () => void;
  canShowMore: boolean;
  loadingMore: boolean;
};

/**
 * Journal entries behind an answer — rendered as soon as retrieval returns,
 * before the answer streams. "Show more entries" pulls a wider set (a larger
 * retrieval limit) without re-triggering the answer.
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
      <div className="grid gap-2 sm:grid-cols-2">
        {evidence.map((item) => (
          <EvidenceCard
            key={item.date}
            date={item.date}
            label={item.label}
            preview={item.preview}
          />
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

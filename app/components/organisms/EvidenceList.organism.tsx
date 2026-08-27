import { EvidenceChip } from "@/app/components/molecules/EvidenceChip.molecule";
import type { Evidence } from "@/lib/types/memory";

type EvidenceListProps = {
  evidence: Evidence[];
};

/** Journal entries the answer was drawn from — the authoritative source. */
export const EvidenceList = ({ evidence }: EvidenceListProps) => {
  if (!evidence.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
        From your journal
      </h3>
      <div className="flex flex-wrap gap-2">
        {evidence.map((item) => (
          <EvidenceChip key={item.date} date={item.date} label={item.label} />
        ))}
      </div>
    </div>
  );
};

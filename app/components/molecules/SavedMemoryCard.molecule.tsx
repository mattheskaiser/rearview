import { EvidenceChip } from "@/app/components/molecules/EvidenceChip.molecule";
import { MemoryMetadata } from "@/app/components/molecules/MemoryMetadata.molecule";
import { Button } from "@/components/ui/button";
import type { SavedMemory } from "@/lib/types/memory";

type SavedMemoryCardProps = {
  memory: SavedMemory;
  onDelete: (id: string) => void;
};

export const SavedMemoryCard = ({ memory, onDelete }: SavedMemoryCardProps) => {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-semibold">{memory.question}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(memory.id)}
          aria-label="Delete memory"
        >
          Delete
        </Button>
      </div>
      <p className="line-clamp-3 text-sm text-muted-foreground">{memory.answer}</p>
      <div className="flex flex-wrap gap-2">
        {memory.evidence.map((item) => (
          <EvidenceChip key={item.date} date={item.date} label={item.label} />
        ))}
      </div>
      <MemoryMetadata
        savedAt={memory.savedAt}
        entryCount={memory.evidence.length}
      />
    </article>
  );
};

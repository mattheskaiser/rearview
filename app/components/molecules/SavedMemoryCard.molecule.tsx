"use client";
import { useEffect, useRef, useState } from "react";

import { EvidenceChip } from "@/app/components/molecules/EvidenceChip.molecule";
import { MemoryMetadata } from "@/app/components/molecules/MemoryMetadata.molecule";
import { RichTextContent } from "@/app/components/molecules/RichTextContent.molecule";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SavedMemory } from "@/lib/types/memory";

type SavedMemoryCardProps = {
  memory: SavedMemory;
  onDelete: (id: string) => void;
};

/** Collapsed preview height before "Show more" appears (~5 lines). */
const PREVIEW_MAX_HEIGHT = 120;

/**
 * A saved Memory. The answer renders with the same formatting as the editor
 * (paragraphs, lists, bold, italic). The preview stays truncated; when the full
 * answer is taller than the preview, a "Show more" control expands it — the
 * stored text is never cut, only the preview (task: "Saved Memories should
 * remain truncated, but users must be able to expand them").
 */
export const SavedMemoryCard = ({ memory, onDelete }: SavedMemoryCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = answerRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > PREVIEW_MAX_HEIGHT + 1);
  }, [memory.answerDoc]);

  const canToggle = overflowing || expanded;

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

      <div
        ref={answerRef}
        data-answer-body
        data-expanded={expanded}
        className={cn(
          "relative overflow-hidden text-muted-foreground",
          !expanded && "max-h-30",
        )}
      >
        <RichTextContent doc={memory.answerDoc} />
        {canToggle && !expanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-background" />
        ) : null}
      </div>

      {canToggle ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Show less" : "Show more"}
          </Button>
        </div>
      ) : null}

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

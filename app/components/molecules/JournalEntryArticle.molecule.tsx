"use client";
import { Minus, Plus } from "lucide-react";

import { RichTextContent } from "@/app/components/molecules/RichTextContent.molecule";
import type { JournalEntryView } from "@/lib/journal.service";

type JournalEntryArticleProps = {
  entry: JournalEntryView;
  open: boolean;
  onToggle: () => void;
};

/**
 * One browsable journal entry: its date as a heading in the required format
 * ("Monday, August 31st 2026"), and — when expanded — the original entry
 * rendered from its stored TipTap document, so paragraphs, line breaks, lists,
 * bold and italic all show exactly as written.
 */
export const JournalEntryArticle = ({
  entry,
  open,
  onToggle,
}: JournalEntryArticleProps) => {
  return (
    <article className="rounded-lg border border-border">
      <h3 className="text-sm">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left font-semibold"
        >
          {entry.heading}
          {open ? (
            <Minus className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Plus className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </h3>
      {open ? (
        <div className="border-t border-border px-4 py-3">
          <RichTextContent doc={entry.doc} />
        </div>
      ) : null}
    </article>
  );
};

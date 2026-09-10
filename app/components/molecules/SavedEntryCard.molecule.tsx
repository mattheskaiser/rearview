"use client";
import type { JSONContent } from "@tiptap/core";

import { RichTextContent } from "@/app/components/molecules/RichTextContent.molecule";
import { Button } from "@/components/ui/button";

type SavedEntryCardProps = {
  /** The stored TipTap document for the selected date. */
  doc: JSONContent | null;
  /** Reveal the editor, pre-filled with `doc`, for a deliberate edit. */
  onEdit: () => void;
};

/**
 * The journal entry that already exists for the selected date, shown read-only
 * with an explicit "Edit entry" affordance. Keeps the Entries composer from
 * ever re-populating itself with already-saved text (task: a submitted entry
 * must not return to the new-entry box — editing is always deliberate).
 */
export const SavedEntryCard = ({ doc, onEdit }: SavedEntryCardProps) => (
  <section
    aria-label="Saved entry for this date"
    className="flex flex-col gap-3 rounded-lg border border-border p-4"
  >
    <RichTextContent doc={doc} />
    <div>
      <Button type="button" variant="outline" size="sm" onClick={onEdit}>
        Edit entry
      </Button>
    </div>
  </section>
);

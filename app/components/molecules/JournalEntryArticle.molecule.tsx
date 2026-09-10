"use client";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { EntryActionsMenu } from "@/app/components/molecules/EntryActionsMenu.molecule";
import { InlineEntryEditor } from "@/app/components/molecules/InlineEntryEditor.molecule";
import { RichTextContent } from "@/app/components/molecules/RichTextContent.molecule";
import { deleteEntryAction } from "@/app/(app)/memories/journal/actions";
import type { JournalEntryView } from "@/lib/journal.service";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type JournalEntryArticleProps = {
  entry: JournalEntryView;
  open: boolean;
  onToggle: () => void;
};

/**
 * One browsable journal entry on a Journal Archive year page: its date as a
 * heading, a "⋯" menu to edit or delete it, and — when expanded — the entry
 * rendered from its stored TipTap document (or the inline editor while editing).
 */
export const JournalEntryArticle = ({
  entry,
  open,
  onToggle,
}: JournalEntryArticleProps) => {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const expand = () => {
    if (!open) onToggle();
  };

  const runDelete = () => {
    startDelete(async () => {
      const result = await deleteEntryAction(entry.id);
      if (result.ok) {
        toastSuccess("Entry deleted");
        router.refresh();
      } else {
        toastError("Could not delete your entry", result.error);
        setConfirmingDelete(false);
      }
    });
  };

  return (
    <article className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 pr-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex flex-1 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold"
        >
          {entry.heading}
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <EntryActionsMenu
          onEdit={() => {
            setConfirmingDelete(false);
            setEditing(true);
            expand();
          }}
          onDelete={() => {
            setEditing(false);
            setConfirmingDelete(true);
            expand();
          }}
        />
      </div>

      {open ? (
        <div className="border-t border-border px-4 py-3">
          {editing ? (
            <InlineEntryEditor
              entryId={entry.id}
              doc={entry.doc}
              onDone={() => setEditing(false)}
            />
          ) : confirmingDelete ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Delete this entry permanently? Its embeddings are removed too.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deletePending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={runDelete}
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting…" : "Delete entry"}
                </Button>
              </div>
            </div>
          ) : (
            <RichTextContent doc={entry.doc} />
          )}
        </div>
      ) : null}
    </article>
  );
};

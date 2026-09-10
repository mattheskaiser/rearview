"use client";
import type { JSONContent } from "@tiptap/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { RichTextEditor } from "@/app/components/organisms/RichTextEditor.organism";
import { updateEntryAction } from "@/app/(app)/memories/journal/actions";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { Button } from "@/components/ui/button";

type InlineEntryEditorProps = {
  entryId: string;
  /** The entry's stored document, used to seed the editor. */
  doc: JSONContent;
  /** Leave edit mode (saved or cancelled). */
  onDone: () => void;
};

/**
 * Edit one journal entry in place inside its Journal Archive accordion. The
 * journal date is fixed — only the text changes; a successful save refreshes
 * the list and re-syncs embeddings server-side.
 */
export const InlineEntryEditor = ({
  entryId,
  doc,
  onDone,
}: InlineEntryEditorProps) => {
  const router = useRouter();
  const [draft, setDraft] = useState<JSONContent>(doc);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await updateEntryAction({ entryId, content: draft });
      if (result.ok) {
        toastSuccess("Entry updated");
        onDone();
        router.refresh();
      } else {
        toastError("Could not update your entry", result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <RichTextEditor
        content={doc}
        onChange={setDraft}
        ariaLabel="Edit journal entry"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
};

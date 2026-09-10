"use client";
import type { JSONContent } from "@tiptap/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { DatePicker } from "@/app/components/molecules/DatePicker.molecule";
import { SavedEntryCard } from "@/app/components/molecules/SavedEntryCard.molecule";
import { RichTextEditor } from "@/app/components/organisms/RichTextEditor.organism";
import { saveEntryAction } from "@/app/(app)/entries/actions";
import { toLocalJournalDateString } from "@/lib/time/journal-date";
import { Button } from "@/components/ui/button";

type EntryFormProps = {
  /** `YYYY-MM-DD` currently being written. */
  dateStr: string;
  /** Existing document for that date, or null for a new entry. */
  initialContent: JSONContent | null;
};

type Status = { tone: "success" | "error"; text: string };

/** Parse `YYYY-MM-DD` into a local Date for the calendar widget. */
function toLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Entries page form. A date that already carries an entry opens read-only (via
 * `SavedEntryCard`); the editor appears only for a fresh date or after an
 * explicit "Edit entry". A saved entry therefore never comes back as editable
 * text in the composer — editing is always deliberate.
 *
 * The page keys this component by date, so navigating dates remounts it with
 * fresh `initialContent`.
 */
export const EntryForm = ({ dateStr, initialContent }: EntryFormProps) => {
  const router = useRouter();
  const [saved, setSaved] = useState<JSONContent | null>(initialContent);
  const [editing, setEditing] = useState(initialContent == null);
  const [draft, setDraft] = useState<JSONContent | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();

  const goToDate = (date: Date | undefined) => {
    if (!date) return;
    setStatus(null);
    router.push(`/entries?date=${toLocalJournalDateString(date)}`);
  };

  const startEditing = () => {
    setStatus(null);
    setDraft(saved);
    setEditing(true);
  };

  const cancelEditing = () => {
    setStatus(null);
    setDraft(null);
    setEditing(false);
  };

  const handleSubmit = () => {
    setStatus(null);
    if (!draft) {
      setStatus({ tone: "error", text: "Write something before saving." });
      return;
    }
    startTransition(async () => {
      const result = await saveEntryAction({ journalDate: dateStr, content: draft });
      if (result.ok) {
        // Back to the read-only view showing exactly what was stored. A failed
        // save keeps the editor and everything the user typed.
        setSaved(draft);
        setDraft(null);
        setEditing(false);
        setStatus({ tone: "success", text: "Entry saved." });
        router.refresh();
      } else {
        setStatus({ tone: "error", text: result.error });
      }
    });
  };

  const message = status ? (
    <FormMessage tone={status.tone}>{status.text}</FormMessage>
  ) : null;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <DatePicker
        value={toLocalDate(dateStr)}
        onChange={goToDate}
        disableAfter={new Date()}
      />

      {editing ? (
        <>
          <RichTextEditor
            content={draft ?? undefined}
            onChange={(doc) => {
              setDraft(doc);
              setStatus(null);
            }}
            ariaLabel="Journal entry"
          />
          <div className="flex items-center justify-between gap-4">
            {message ?? <span />}
            <div className="flex gap-2">
              {saved ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={pending}
                >
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : saved ? "Update entry" : "Save entry"}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <SavedEntryCard doc={saved} onEdit={startEditing} />
          {message}
        </>
      )}
    </form>
  );
};

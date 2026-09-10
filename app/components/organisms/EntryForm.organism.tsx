"use client";
import type { JSONContent } from "@tiptap/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DatePicker } from "@/app/components/molecules/DatePicker.molecule";
import { RichTextEditor } from "@/app/components/organisms/RichTextEditor.organism";
import { saveEntryAction } from "@/app/(app)/entries/actions";
import { toLocalJournalDateString } from "@/lib/time/journal-date";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { Button } from "@/components/ui/button";

type EntryFormProps = {
  /** `YYYY-MM-DD` currently being written. */
  dateStr: string;
  /** Whether this user already has an entry on `dateStr`. */
  dateHasEntry: boolean;
};

/** Parse `YYYY-MM-DD` into a local Date for the calendar widget. */
function toLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Entries page composer. Always a blank editor — a submitted entry never comes
 * back into the box. There is one entry per calendar date: a date that already
 * has an entry can still be typed in, but the save is refused with a toast that
 * points to the Journal Archive, where existing entries are edited.
 */
export const EntryForm = ({ dateStr, dateHasEntry }: EntryFormProps) => {
  const router = useRouter();
  const [draft, setDraft] = useState<JSONContent | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const goToDate = (date: Date | undefined) => {
    if (!date) return;
    router.push(`/entries?date=${toLocalJournalDateString(date)}`);
  };

  const handleSubmit = () => {
    if (dateHasEntry) {
      toastError(
        "You already have an entry for this date",
        "Edit it from the Journal Archive on the Memories page.",
      );
      return;
    }
    if (!draft) {
      toastError("Nothing to save", "Write something before saving.");
      return;
    }
    startTransition(async () => {
      const result = await saveEntryAction({ journalDate: dateStr, content: draft });
      if (result.ok) {
        setDraft(null);
        setEditorKey((key) => key + 1); // remount the editor empty
        toastSuccess("Entry saved");
        router.refresh();
      } else {
        toastError("Could not save your entry", result.error);
      }
    });
  };

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

      {dateHasEntry ? (
        <p className="text-sm text-muted-foreground">
          You already have an entry for this date.{" "}
          <Link
            href={`/memories/journal/${dateStr.slice(0, 4)}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Edit it in the Journal Archive
          </Link>
          .
        </p>
      ) : null}

      <RichTextEditor
        key={editorKey}
        onChange={setDraft}
        ariaLabel="Journal entry"
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save entry"}
        </Button>
      </div>
    </form>
  );
};

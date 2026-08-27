"use client";
import type { JSONContent } from "@tiptap/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { DatePicker } from "@/app/components/molecules/DatePicker.molecule";
import { JournalEditor } from "@/app/components/organisms/JournalEditor.organism";
import { saveEntryAction } from "@/app/entries/actions";
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

export const EntryForm = ({ dateStr, initialContent }: EntryFormProps) => {
  const router = useRouter();
  const [doc, setDoc] = useState<JSONContent | null>(initialContent);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();

  const goToDate = (date: Date | undefined) => {
    if (!date) return;
    setStatus(null);
    router.push(`/entries?date=${toLocalJournalDateString(date)}`);
  };

  const handleSubmit = () => {
    setStatus(null);
    if (!doc) {
      setStatus({ tone: "error", text: "Write something before saving." });
      return;
    }
    startTransition(async () => {
      const result = await saveEntryAction({ journalDate: dateStr, content: doc });
      if (result.ok) {
        setStatus({ tone: "success", text: "Entry saved." });
        router.refresh();
      } else {
        setStatus({ tone: "error", text: result.error });
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
      <DatePicker value={toLocalDate(dateStr)} onChange={goToDate} />
      <JournalEditor content={initialContent ?? undefined} onChange={setDoc} />
      <div className="flex items-center justify-between gap-4">
        {status ? (
          <FormMessage tone={status.tone}>{status.text}</FormMessage>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initialContent ? "Update entry" : "Save entry"}
        </Button>
      </div>
    </form>
  );
};

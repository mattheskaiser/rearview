"use client";
import { useMemo, useState } from "react";

import { EmptyState } from "@/app/components/atoms/EmptyState.atom";
import { JournalEntryArticle } from "@/app/components/molecules/JournalEntryArticle.molecule";
import { MonthFilter } from "@/app/components/molecules/MonthFilter.molecule";
import type { JournalEntryView } from "@/lib/journal.service";
import { monthOf, monthsWithEntries } from "@/lib/time/journal-months";

type JournalYearViewProps = {
  year: number;
  /** Every entry for `year`, newest first (from the journal service). */
  entries: JournalEntryView[];
};

/**
 * One year of the journal: a month filter above a newest-to-oldest list of
 * entries, each expandable and rendered from its stored editor document so the
 * original rich-text formatting is preserved. Filtering is entirely local —
 * every entry for the year is already loaded.
 */
export const JournalYearView = ({ year, entries }: JournalYearViewProps) => {
  const [month, setMonth] = useState<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(entries[0]?.id ?? null);

  const months = useMemo(
    () => monthsWithEntries(entries.map((entry) => entry.journalDate)),
    [entries],
  );

  const visible =
    month === null
      ? entries
      : entries.filter((entry) => monthOf(entry.journalDate) === month);

  return (
    <div className="flex flex-col gap-5">
      <MonthFilter months={months} selected={month} onSelect={setMonth} />

      <p className="text-xs text-muted-foreground">
        {visible.length} {visible.length === 1 ? "entry" : "entries"}
        {month === null ? ` in ${year}` : ""}, newest first
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title="No entries this month"
          description="Pick another month, or go back to All."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((entry) => (
            <JournalEntryArticle
              key={entry.id}
              entry={entry}
              open={openId === entry.id}
              onToggle={() =>
                setOpenId((current) =>
                  current === entry.id ? null : entry.id,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

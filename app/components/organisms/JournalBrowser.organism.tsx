"use client";
import { useRef, useState } from "react";

import { EmptyState } from "@/app/components/atoms/EmptyState.atom";
import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { Spinner } from "@/app/components/atoms/Spinner.atom";
import { JournalEntryArticle } from "@/app/components/molecules/JournalEntryArticle.molecule";
import { YearNav } from "@/app/components/molecules/YearNav.molecule";
import { listJournalEntriesForYearAction } from "@/app/(app)/memories/actions";
import type {
  JournalEntryView,
  JournalYearSummary,
} from "@/lib/journal.service";

type JournalBrowserProps = {
  /** Years with entries, newest first (from the server). */
  years: JournalYearSummary[];
  /** The year shown first — normally the most recent. Null when there are none. */
  initialYear: number | null;
  /** Entries for `initialYear`, already loaded server-side (no first-view flash). */
  initialEntries: JournalEntryView[];
};

/**
 * Browse past journal entries, organised by year. The first year is rendered
 * from server data; picking another year loads it through a server action
 * (scoped to the user). Picking an entry expands it and renders it from its
 * stored editor document. The Memories page keeps this mounted while the
 * Reflect tab shows, so the selected year / entry survive tab switches.
 */
export const JournalBrowser = ({
  years,
  initialYear,
  initialEntries,
}: JournalBrowserProps) => {
  const yearNumbers = years.map((y) => y.year).sort((a, b) => a - b);

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [entries, setEntries] = useState(initialEntries);
  const [openId, setOpenId] = useState<string | null>(
    initialEntries[0]?.id ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const selectYear = async (year: number) => {
    if (year === selectedYear) return;
    setSelectedYear(year);
    setOpenId(null);
    setError(null);
    setLoading(true);
    const id = (requestId.current += 1);

    const result = await listJournalEntriesForYearAction(year);
    if (id !== requestId.current) return; // a newer year won the race

    setLoading(false);
    if (result.ok) {
      setEntries(result.entries);
      setOpenId(result.entries[0]?.id ?? null);
    } else {
      setEntries([]);
      setError(result.error);
    }
  };

  if (years.length === 0 || selectedYear == null) {
    return (
      <EmptyState
        title="No journal entries yet"
        description="Write an entry and it will show up here to browse by year."
      />
    );
  }

  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <YearNav
        years={yearNumbers}
        selected={selectedYear}
        onSelect={selectYear}
        ariaLabel="Journal year"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading {selectedYear}…
          </p>
        ) : null}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {!loading && !error && entries.length === 0 ? (
          <EmptyState
            title={`No entries in ${selectedYear}`}
            description="Pick another year from the list."
          />
        ) : null}
        {!loading
          ? entries.map((entry) => (
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
            ))
          : null}
      </div>
    </section>
  );
};

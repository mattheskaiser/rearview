import { EmptyState } from "@/app/components/atoms/EmptyState.atom";
import { JournalYearView } from "@/app/components/organisms/JournalYearView.organism";
import { PageTemplate } from "@/app/components/templates/Page.template";
import type { JournalEntryView } from "@/lib/journal.service";

type JournalYearTemplateProps = {
  /** The requested segment — a number when it parsed, the raw string otherwise. */
  year: number | string;
  /** False when the URL segment was not a usable year. */
  valid: boolean;
  entries: JournalEntryView[];
};

const BACK = { href: "/memories", label: "Back to Memories" } as const;

/**
 * Page layout for `/memories/journal/[year]`: a back link to Memories, the
 * "Journal {year}" heading, and either the year's entries (with month filter)
 * or a clear empty / not-a-year state that still routes home.
 */
export const JournalYearTemplate = ({
  year,
  valid,
  entries,
}: JournalYearTemplateProps) => {
  if (!valid) {
    return (
      <PageTemplate heading="Journal" backLink={BACK}>
        <EmptyState
          title={`"${year}" is not a valid year`}
          description="Choose a year from the Journal Archive on the Memories page."
        />
      </PageTemplate>
    );
  }

  return (
    <PageTemplate heading={`Journal ${year}`} backLink={BACK}>
      {entries.length === 0 ? (
        <EmptyState
          title={`No entries from ${year}`}
          description="You have not written anything dated in this year yet."
        />
      ) : (
        <JournalYearView year={Number(year)} entries={entries} />
      )}
    </PageTemplate>
  );
};

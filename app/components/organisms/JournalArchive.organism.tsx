import { EmptyState } from "@/app/components/atoms/EmptyState.atom";
import { JournalVolumeCard } from "@/app/components/molecules/JournalVolumeCard.molecule";
import type { JournalYearSummary } from "@/lib/journal.service";

type JournalArchiveProps = {
  /** Years that contain entries, newest first (from the journal service). */
  years: JournalYearSummary[];
};

/**
 * The Journal Archive on the Memories page: a shelf of yearly volumes, one card
 * per year the user has written in, newest first. Years with no entries never
 * appear. Distinct from Reflect — this is reading back what was written, not
 * asking the AI about it.
 */
export const JournalArchive = ({ years }: JournalArchiveProps) => {
  return (
    <section
      aria-labelledby="journal-archive-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="journal-archive-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Journal Archive
        </h2>
        <p className="text-sm text-muted-foreground">
          Every year you have written in. Open a volume to read that year.
        </p>
      </div>

      {years.length === 0 ? (
        <EmptyState
          title="No journal entries yet"
          description="Once you write entries, each year shows up here as its own volume."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {years.map((summary) => (
            <li key={summary.year}>
              <JournalVolumeCard year={summary.year} count={summary.count} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

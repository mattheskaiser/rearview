import Link from "next/link";

type EvidenceCardProps = {
  /** YYYY-MM-DD */
  date: string;
  /** Human-readable date label, e.g. "Mar 4, 2022". */
  label: string;
  /** Short preview of what the user wrote in that entry. */
  preview: string;
};

/**
 * A dated journal entry that informed an answer, with a preview of the user's
 * own words. Clicking opens the entry — the authoritative source, same as the
 * old chips.
 */
export const EvidenceCard = ({ date, label, preview }: EvidenceCardProps) => {
  return (
    <Link
      href={`/entries?date=${date}`}
      data-evidence-card
      className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted"
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="line-clamp-2 text-sm text-foreground">{preview}</span>
    </Link>
  );
};

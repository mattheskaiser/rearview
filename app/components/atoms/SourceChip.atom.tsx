import Link from "next/link";

type SourceChipProps = {
  /** YYYY-MM-DD */
  date: string;
  /** Human-readable date label, e.g. "Mar 4, 2022". */
  label: string;
};

/**
 * A dated journal entry that informed an answer — just the date, not a text
 * preview. The answer itself now quotes the relevant phrase inline, so this
 * only needs to say *which* entries were used and link to the authoritative
 * source; it doesn't need to repeat their content.
 */
export const SourceChip = ({ date, label }: SourceChipProps) => {
  return (
    <Link
      href={`/entries?date=${date}`}
      data-evidence-card
      className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
    </Link>
  );
};

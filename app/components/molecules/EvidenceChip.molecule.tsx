import Link from "next/link";

type EvidenceChipProps = {
  /** YYYY-MM-DD */
  date: string;
  label: string;
};

/** A dated reference to a journal entry that informed an answer. */
export const EvidenceChip = ({ date, label }: EvidenceChipProps) => {
  return (
    <Link
      href={`/entries?date=${date}`}
      className="inline-flex items-center rounded-full bg-secondary/60 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary"
    >
      {label}
    </Link>
  );
};

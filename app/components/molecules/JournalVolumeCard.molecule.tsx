import { BookText } from "lucide-react";
import Link from "next/link";

type JournalVolumeCardProps = {
  year: number;
  /** How many entries that year holds. */
  count: number;
};

/**
 * One year of the journal, presented as a book on a shelf: a coloured "spine"
 * down the left edge, a volume icon, the year, and the entry count. The whole
 * card is the link to `/memories/journal/[year]`.
 */
export const JournalVolumeCard = ({ year, count }: JournalVolumeCardProps) => {
  return (
    <Link
      href={`/memories/journal/${year}`}
      aria-label={`Journal ${year}, ${count} ${count === 1 ? "entry" : "entries"}`}
      className="group flex h-full cursor-pointer flex-col gap-4 rounded-lg border border-l-4 border-border border-l-primary/50 bg-card px-4 py-4 transition-colors hover:border-l-primary hover:bg-secondary/40"
    >
      <BookText
        className="size-5 text-muted-foreground transition-colors group-hover:text-foreground"
        aria-hidden
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-2xl font-semibold tracking-tight">{year}</span>
        <span className="text-xs text-muted-foreground">
          {count} {count === 1 ? "entry" : "entries"}
        </span>
      </div>
    </Link>
  );
};

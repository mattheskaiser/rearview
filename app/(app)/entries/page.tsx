import { EntryForm } from "@/app/components/organisms/EntryForm.organism";
import { PageTemplate } from "@/app/components/templates/Page.template";
import { requireUserId } from "@/lib/auth/session";
import { hasJournalEntryOnDate } from "@/lib/journal.service";
import {
  formatJournalDate,
  isFutureJournalDate,
  toJournalDate,
  toLocalJournalDateString,
} from "@/lib/time/journal-date";

// Reads `?date=` and the database per request — never statically prerendered,
// so `npm run build` needs no live DB.
export const dynamic = "force-dynamic";

/** Resolve `?date=` to a safe `YYYY-MM-DD`, defaulting to today. */
function resolveDate(raw: string | undefined): string {
  if (!raw) return toLocalJournalDateString();
  try {
    const date = toJournalDate(raw);
    if (isFutureJournalDate(date)) return toLocalJournalDateString();
    return formatJournalDate(date);
  } catch {
    return toLocalJournalDateString();
  }
}

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const userId = await requireUserId();
  const { date } = await searchParams;
  const dateStr = resolveDate(date);
  const dateHasEntry = await hasJournalEntryOnDate(userId, dateStr);

  return (
    <PageTemplate heading="Write an entry">
      <EntryForm key={dateStr} dateStr={dateStr} dateHasEntry={dateHasEntry} />
    </PageTemplate>
  );
}

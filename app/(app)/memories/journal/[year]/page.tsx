import { z } from "zod";

import { JournalYearTemplate } from "@/app/components/templates/JournalYear.template";
import { requireUserId } from "@/lib/auth/session";
import { listJournalEntriesForYear } from "@/lib/journal.service";

// Reads the session + database per request; never statically prerendered.
export const dynamic = "force-dynamic";

const yearSchema = z.coerce.number().int().gte(1900).lte(9999);

export default async function JournalYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const userId = await requireUserId();
  const { year: raw } = await params;
  const parsed = yearSchema.safeParse(raw);

  if (!parsed.success) {
    return <JournalYearTemplate year={raw} valid={false} entries={[]} />;
  }

  const entries = await listJournalEntriesForYear(userId, parsed.data);
  return (
    <JournalYearTemplate year={parsed.data} valid entries={entries} />
  );
}

import { MemoriesTemplate } from "@/app/components/templates/Memories.template";
import { requireUserId } from "@/lib/auth/session";
import { listJournalYears } from "@/lib/journal.service";
import { listSavedMemories } from "@/lib/memory.service";

// Reads the session + database per request; never statically prerendered, so
// `npm run build` needs no live DB.
export const dynamic = "force-dynamic";

export default async function MemoriesPage() {
  const userId = await requireUserId();
  const [savedMemories, journalYears] = await Promise.all([
    listSavedMemories(userId),
    listJournalYears(userId),
  ]);

  return (
    <MemoriesTemplate savedMemories={savedMemories} journalYears={journalYears} />
  );
}

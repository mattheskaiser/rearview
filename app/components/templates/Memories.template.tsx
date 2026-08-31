import { JournalArchive } from "@/app/components/organisms/JournalArchive.organism";
import { MemoryList } from "@/app/components/organisms/MemoryList.organism";
import { ReflectionPanel } from "@/app/components/organisms/ReflectionPanel.organism";
import { PageTemplate } from "@/app/components/templates/Page.template";
import type { JournalYearSummary } from "@/lib/journal.service";
import type { SavedMemory } from "@/lib/types/memory";

type MemoriesTemplateProps = {
  savedMemories: SavedMemory[];
  journalYears: JournalYearSummary[];
};

/**
 * The Memories page. Reflect stays the primary experience — ask the journal a
 * question, save the answer. Below it, the Journal Archive is its own distinct
 * section: one book-like card per year, each opening that year at
 * `/memories/journal/[year]`. The reflection stream lives in the route layout,
 * so an in-flight AI search keeps running when the user opens a year and back.
 */
export const MemoriesTemplate = ({
  savedMemories,
  journalYears,
}: MemoriesTemplateProps) => {
  return (
    <PageTemplate
      heading="Memories"
      subtitle={
        <p className="text-sm text-muted-foreground">
          Ask a question and Rearview synthesizes an answer from your journal, or
          open a year from the archive to read it back.
        </p>
      }
    >
      <div className="flex flex-col gap-14">
        <section className="flex flex-col gap-10">
          <ReflectionPanel />
          <MemoryList memories={savedMemories} />
        </section>

        <JournalArchive years={journalYears} />
      </div>
    </PageTemplate>
  );
};

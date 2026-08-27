import { MemoryList } from "@/app/components/organisms/MemoryList.organism";
import { ReflectionPanel } from "@/app/components/organisms/ReflectionPanel.organism";
import { PageTemplate } from "@/app/components/templates/Page.template";
import type { SavedMemory } from "@/lib/types/memory";

type MemoriesTemplateProps = {
  savedMemories: SavedMemory[];
};

export const MemoriesTemplate = ({ savedMemories }: MemoriesTemplateProps) => {
  return (
    <PageTemplate
      heading="Memories"
      subtitle={
        <p className="text-sm text-muted-foreground">
          Ask a question and Rearview synthesizes an answer from your journal.
        </p>
      }
    >
      <ReflectionPanel />
      <MemoryList memories={savedMemories} />
    </PageTemplate>
  );
};

import { Heading } from "@/app/components/atoms/Heading.atom";
import { MemoryList } from "@/app/components/organisms/MemoryList.organism";
import { ReflectionPanel } from "@/app/components/organisms/ReflectionPanel.organism";
import type { SavedMemory } from "@/lib/types/memory";

type MemoriesTemplateProps = {
  savedMemories: SavedMemory[];
};

export const MemoriesTemplate = ({ savedMemories }: MemoriesTemplateProps) => {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 p-8">
      <header className="flex flex-col gap-1">
        <Heading>Memories</Heading>
        <p className="text-sm text-muted-foreground">
          Ask a question and Rearview synthesizes an answer from your journal.
        </p>
      </header>

      <ReflectionPanel />
      <MemoryList memories={savedMemories} />
    </div>
  );
};

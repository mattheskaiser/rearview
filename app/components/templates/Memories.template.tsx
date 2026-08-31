"use client";
import { useState } from "react";

import { TabNav, type TabItem } from "@/app/components/molecules/TabNav.molecule";
import { JournalBrowser } from "@/app/components/organisms/JournalBrowser.organism";
import { MemoryList } from "@/app/components/organisms/MemoryList.organism";
import { ReflectionPanel } from "@/app/components/organisms/ReflectionPanel.organism";
import { PageTemplate } from "@/app/components/templates/Page.template";
import { ReflectionProvider } from "@/app/hooks/reflection-context";
import type {
  JournalEntryView,
  JournalYearSummary,
} from "@/lib/journal.service";
import type { SavedMemory } from "@/lib/types/memory";

type MemoriesTemplateProps = {
  savedMemories: SavedMemory[];
  journalYears: JournalYearSummary[];
  initialYear: number | null;
  initialEntries: JournalEntryView[];
};

type TabId = "reflect" | "journal";

const TABS: readonly TabItem<TabId>[] = [
  { id: "reflect", label: "Reflect" },
  { id: "journal", label: "Journal" },
];

/**
 * The Memories page: ask the journal a question (Reflect) or browse past
 * entries by year (Journal). Both panels stay mounted and the reflection stream
 * lives in a provider above the tabs, so an in-flight AI search — and the
 * Journal tab's selection — survive switching between them.
 */
export const MemoriesTemplate = ({
  savedMemories,
  journalYears,
  initialYear,
  initialEntries,
}: MemoriesTemplateProps) => {
  const [tab, setTab] = useState<TabId>("reflect");

  return (
    <PageTemplate
      heading="Memories"
      subtitle={
        <p className="text-sm text-muted-foreground">
          Ask a question and Rearview synthesizes an answer from your journal, or
          browse everything you have written.
        </p>
      }
    >
      <ReflectionProvider>
        <div className="flex flex-col gap-6">
          <TabNav
            tabs={TABS}
            active={tab}
            onChange={setTab}
            ariaLabel="Memories sections"
          />

          <div hidden={tab !== "reflect"} className="flex flex-col gap-10">
            <ReflectionPanel />
            <MemoryList memories={savedMemories} />
          </div>

          <div hidden={tab !== "journal"}>
            <JournalBrowser
              years={journalYears}
              initialYear={initialYear}
              initialEntries={initialEntries}
            />
          </div>
        </div>
      </ReflectionProvider>
    </PageTemplate>
  );
};

import type { JSONContent } from "@tiptap/core";

import { GreetingText } from "@/app/components/atoms/GreetingText.atom";
import { ActivityMap } from "@/app/components/organisms/ActivityMap.organism";
import { BackupPanel } from "@/app/components/organisms/BackupPanel.organism";
import { CurrentGoals } from "@/app/components/organisms/CurrentGoals.organism";
import { PageTemplate } from "@/app/components/templates/Page.template";
import type { BackupSummary } from "@/lib/backup.service";
import type { GreetingPeriod } from "@/lib/time/greeting";

type OverviewTemplateProps = {
  name: string;
  greeting: GreetingPeriod;
  goalsContent: JSONContent | null;
  entryDates: string[];
  today: string;
  lastBackup: BackupSummary | null;
};

export const OverviewTemplate = ({
  name,
  greeting,
  goalsContent,
  entryDates,
  today,
  lastBackup,
}: OverviewTemplateProps) => {
  return (
    <PageTemplate
      heading="Overview"
      subtitle={<GreetingText period={greeting} name={name} />}
    >
      <CurrentGoals initialContent={goalsContent} />
      <ActivityMap entryDates={entryDates} today={today} />
      <BackupPanel lastBackup={lastBackup} />
    </PageTemplate>
  );
};

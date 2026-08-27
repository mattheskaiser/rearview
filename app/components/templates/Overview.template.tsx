import type { JSONContent } from "@tiptap/core";

import { GreetingText } from "@/app/components/atoms/GreetingText.atom";
import { ActivityMap } from "@/app/components/organisms/ActivityMap.organism";
import { CurrentGoals } from "@/app/components/organisms/CurrentGoals.organism";
import { PageTemplate } from "@/app/components/templates/Page.template";
import type { GreetingPeriod } from "@/lib/time/greeting";

type OverviewTemplateProps = {
  name: string;
  greeting: GreetingPeriod;
  goalsContent: JSONContent | null;
  entryDates: string[];
  today: string;
};

export const OverviewTemplate = ({
  name,
  greeting,
  goalsContent,
  entryDates,
  today,
}: OverviewTemplateProps) => {
  return (
    <PageTemplate
      heading="Overview"
      subtitle={<GreetingText period={greeting} name={name} />}
    >
      <CurrentGoals initialContent={goalsContent} />
      <ActivityMap entryDates={entryDates} today={today} />
    </PageTemplate>
  );
};

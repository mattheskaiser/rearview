import { GreetingText } from "@/app/components/atoms/GreetingText.atom";
import { Heading } from "@/app/components/atoms/Heading.atom";
import { ActivityMap } from "@/app/components/organisms/ActivityMap.organism";
import { CurrentGoals } from "@/app/components/organisms/CurrentGoals.organism";

type OverviewTemplateProps = {
  name?: string;
  goals?: string;
  entryDates: string[];
};

export const OverviewTemplate = ({
  name,
  goals,
  entryDates,
}: OverviewTemplateProps) => {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 p-8">
      <header className="flex flex-col gap-1">
        <Heading>Overview</Heading>
        <GreetingText name={name} />
      </header>

      <CurrentGoals initialValue={goals} />
      <ActivityMap entryDates={entryDates} />
    </div>
  );
};

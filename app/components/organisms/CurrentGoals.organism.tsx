import { GoalCard } from "@/app/components/molecules/GoalCard.molecule";

type CurrentGoalsProps = {
  initialValue?: string;
};

export const CurrentGoals = ({ initialValue }: CurrentGoalsProps) => {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
        Current goals
      </h2>
      <GoalCard initialValue={initialValue} />
    </section>
  );
};

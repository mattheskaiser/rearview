import type { GreetingPeriod } from "@/lib/time/greeting";

const LABELS: Record<GreetingPeriod, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
};

type GreetingTextProps = {
  /** Resolved server-side against the host machine's timezone. */
  period: GreetingPeriod;
  name: string;
};

/** Time-aware greeting, e.g. "Good morning, Matthes." */
export const GreetingText = ({ period, name }: GreetingTextProps) => {
  return (
    <p className="text-lg text-muted-foreground">
      {LABELS[period]}, {name}.
    </p>
  );
};

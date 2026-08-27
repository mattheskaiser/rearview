"use client";
import { useSyncExternalStore } from "react";

import { getGreeting, type GreetingPeriod } from "@/lib/time/greeting";

const LABELS: Record<GreetingPeriod, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
};

const subscribe = () => () => {};

type GreetingTextProps = { name?: string };

/**
 * Time-aware greeting. The period is read from the browser clock on the client
 * only (server snapshot is null) to avoid a hydration mismatch.
 */
export const GreetingText = ({ name }: GreetingTextProps) => {
  const period = useSyncExternalStore<GreetingPeriod | null>(
    subscribe,
    () => getGreeting(new Date()),
    () => null,
  );

  const greeting = period ? LABELS[period] : "Hello";

  return (
    <p className="text-lg text-muted-foreground">
      {greeting}
      {name ? `, ${name}` : ""}.
    </p>
  );
};

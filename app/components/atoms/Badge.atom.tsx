import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeProps = {
  children: ReactNode;
  /** "neutral" hairline badge or "accent" soft secondary fill. */
  variant?: "neutral" | "accent";
  className?: string;
};

export const Badge = ({ children, variant = "neutral", className }: BadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "accent"
          ? "bg-secondary/60 text-secondary-foreground"
          : "border border-border text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
};

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FormMessageProps = {
  tone: "success" | "error";
  children: ReactNode;
};

/** Inline status line for a form submit (validation / save outcome). */
export const FormMessage = ({ tone, children }: FormMessageProps) => {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "text-sm",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
};

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export const Spinner = ({ className }: { className?: string }) => {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("h-4 w-4 animate-spin text-muted-foreground", className)}
    />
  );
};

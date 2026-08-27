import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type HeadingProps = {
  children: ReactNode;
  className?: string | undefined;
  /** Which heading element to render. Visual size stays constant. */
  as?: "h1" | "h2" | "h3";
};

export const Heading = ({ children, className, as: Tag = "h1" }: HeadingProps) => {
  return <Tag className={cn("text-3xl font-semibold", className)}>{children}</Tag>;
};

import type { ReactNode } from "react";

import { Heading } from "@/app/components/atoms/Heading.atom";

type PageTemplateProps = {
  heading: string;
  /** Optional supporting line rendered directly under the heading. */
  subtitle?: ReactNode;
  children: ReactNode;
};

/**
 * Shared shell for every page inside the app shell. Gives Overview, Entries and
 * Memories the same centered column: one max width, one set of horizontal
 * margins, one page padding and one vertical rhythm.
 */
export const PageTemplate = ({ heading, subtitle, children }: PageTemplateProps) => {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 p-8">
      <header className="flex flex-col gap-1">
        <Heading>{heading}</Heading>
        {subtitle}
      </header>
      {children}
    </div>
  );
};

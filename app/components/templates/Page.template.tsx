import type { ReactNode } from "react";

import { BackLink } from "@/app/components/atoms/BackLink.atom";
import { Heading } from "@/app/components/atoms/Heading.atom";

type PageTemplateProps = {
  heading: string;
  /** Optional "back to parent" link rendered above the heading. */
  backLink?: { href: string; label: string };
  /** Optional supporting line rendered directly under the heading. */
  subtitle?: ReactNode;
  children: ReactNode;
};

/**
 * Shared shell for every page inside the app shell. Gives Overview, Entries and
 * Memories the same centered column: one max width, one set of horizontal
 * margins, one page padding and one vertical rhythm.
 */
export const PageTemplate = ({
  heading,
  backLink,
  subtitle,
  children,
}: PageTemplateProps) => {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 p-8">
      <header className="flex flex-col gap-1">
        {backLink ? (
          <div className="mb-3">
            <BackLink href={backLink.href} label={backLink.label} />
          </div>
        ) : null}
        <Heading>{heading}</Heading>
        {subtitle}
      </header>
      {children}
    </div>
  );
};

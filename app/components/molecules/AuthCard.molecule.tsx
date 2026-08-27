import Link from "next/link";
import type { ReactNode } from "react";

import { Heading } from "@/app/components/atoms/Heading.atom";

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Optional footer link (e.g. "Need an account? Register"). */
  footer?: { prompt: string; href: string; linkLabel: string };
};

/** Shared shell for the login and register screens. */
export const AuthCard = ({ title, subtitle, children, footer }: AuthCardProps) => {
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
      <header className="flex flex-col gap-1">
        <Heading as="h1" className="text-2xl">
          {title}
        </Heading>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </header>

      {children}

      {footer ? (
        <p className="text-sm text-muted-foreground">
          {footer.prompt}{" "}
          <Link
            href={footer.href}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {footer.linkLabel}
          </Link>
        </p>
      ) : null}
    </div>
  );
};

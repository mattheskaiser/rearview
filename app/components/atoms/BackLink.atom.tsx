import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type BackLinkProps = {
  href: string;
  label: string;
};

/**
 * A quiet "← back" link for stepping up a level — used above a page heading to
 * return from a nested route to its parent.
 */
export const BackLink = ({ href, label }: BackLinkProps) => {
  return (
    <Link
      href={href}
      className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
};

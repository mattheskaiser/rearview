"use client";

import { useTransition } from "react";

import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

/** Ends the session server-side (Better Auth deletes the row + cookie). */
export const LogoutButton = () => {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
};

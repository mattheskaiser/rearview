"use client";

import { useState, useTransition } from "react";

import { AuthField } from "@/app/components/molecules/AuthField.molecule";
import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { signInAction } from "@/app/(auth)/actions";
import { signInSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";

type FieldErrors = Partial<Record<"email" | "password", string>>;

/** Email + password sign-in. Server action does the real check; this is UX. */
export const LoginForm = () => {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = signInSchema.safeParse(data);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") next[key] ??= issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await signInAction(parsed.data);
      // Success redirects server-side; only a failure returns here.
      if (result && !result.ok) setFormError(result.error);
    });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <AuthField
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={fieldErrors.email}
        disabled={pending}
      />
      <AuthField
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={fieldErrors.password}
        disabled={pending}
      />
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
};

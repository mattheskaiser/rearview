"use client";

import { useState, useTransition } from "react";

import { AuthField } from "@/app/components/molecules/AuthField.molecule";
import { FormMessage } from "@/app/components/atoms/FormMessage.atom";
import { signUpAction } from "@/app/(auth)/actions";
import { signUpSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";

type FieldKey = "name" | "email" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldKey, string>>;

/** Create the first account. Server action re-validates and enforces the lock. */
export const RegisterForm = () => {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = signUpSchema.safeParse(data);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldKey | undefined;
        if (key) next[key] ??= issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await signUpAction(parsed.data);
      if (result && !result.ok) setFormError(result.error);
    });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <AuthField
        id="name"
        name="name"
        label="Name"
        autoComplete="name"
        error={fieldErrors.name}
        disabled={pending}
      />
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
        autoComplete="new-password"
        error={fieldErrors.password}
        disabled={pending}
      />
      <AuthField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
        disabled={pending}
      />
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
};

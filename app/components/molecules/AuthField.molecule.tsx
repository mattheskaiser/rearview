import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type AuthFieldProps = {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  defaultValue?: string;
  /** Validation message for this field, if any. */
  error?: string;
  disabled?: boolean;
};

/** One labelled input with an inline error — the auth forms' building block. */
export const AuthField = ({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  defaultValue,
  error,
  disabled,
}: AuthFieldProps) => {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        required
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
};

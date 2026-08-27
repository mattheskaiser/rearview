import { z } from "zod";

/**
 * Server-side validation boundary for authentication (session prompt >
 * Validation). The auth forms validate client-side for UX, but every field is
 * re-parsed here in the server action before it reaches Better Auth. Passwords
 * are never trimmed, logged, or echoed back.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NAME_LENGTH = 80;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254));

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`);

export const signInSchema = z.object({
  email: emailSchema,
  // Only presence matters on sign-in — the hash comparison is the real check.
  password: z.string().min(1, "Enter your password").max(MAX_PASSWORD_LENGTH),
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(MAX_NAME_LENGTH),
    email: emailSchema,
    password: passwordSchema
      .regex(/[a-zA-Z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

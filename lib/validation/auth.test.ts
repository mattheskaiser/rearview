import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "@/lib/validation/auth";

const validSignUp = {
  name: "Matthes",
  email: "Matthes@Example.com ",
  password: "correct horse1",
  confirmPassword: "correct horse1",
};

describe("signInSchema", () => {
  it("normalises the email and keeps the password verbatim", () => {
    const parsed = signInSchema.parse({
      email: "  ME@Example.COM ",
      password: "  spaces kept  ",
    });
    expect(parsed.email).toBe("me@example.com");
    expect(parsed.password).toBe("  spaces kept  ");
  });

  it("requires a non-empty password", () => {
    expect(signInSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(
      false,
    );
  });

  it("rejects a malformed email", () => {
    expect(
      signInSchema.safeParse({ email: "not-an-email", password: "x" }).success,
    ).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("accepts a valid registration and lower-cases the email", () => {
    const parsed = signUpSchema.parse(validSignUp);
    expect(parsed.email).toBe("matthes@example.com");
    expect(parsed.name).toBe("Matthes");
  });

  it("rejects a short password", () => {
    const result = signUpSchema.safeParse({
      ...validSignUp,
      password: "ab1",
      confirmPassword: "ab1",
    });
    expect(result.success).toBe(false);
  });

  it("requires a letter and a number in the password", () => {
    expect(
      signUpSchema.safeParse({
        ...validSignUp,
        password: "aaaaaaaaa",
        confirmPassword: "aaaaaaaaa",
      }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        ...validSignUp,
        password: "111111111",
        confirmPassword: "111111111",
      }).success,
    ).toBe(false);
  });

  it("rejects a confirmation mismatch, flagged on confirmPassword", () => {
    const result = signUpSchema.safeParse({
      ...validSignUp,
      confirmPassword: "different1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });

  it("requires a name", () => {
    expect(
      signUpSchema.safeParse({ ...validSignUp, name: "   " }).success,
    ).toBe(false);
  });
});

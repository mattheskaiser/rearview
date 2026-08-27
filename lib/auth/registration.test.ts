import { describe, expect, it } from "vitest";

import { canRegister } from "@/lib/auth/registration";

describe("canRegister", () => {
  it("allows the very first account regardless of the flag", () => {
    expect(canRegister({ userCount: 0, allowRegistration: false })).toBe(true);
    expect(canRegister({ userCount: 0, allowRegistration: true })).toBe(true);
  });

  it("closes sign-up once an account exists", () => {
    expect(canRegister({ userCount: 1, allowRegistration: false })).toBe(false);
    expect(canRegister({ userCount: 5, allowRegistration: false })).toBe(false);
  });

  it("re-opens sign-up only when the flag is explicitly enabled", () => {
    expect(canRegister({ userCount: 1, allowRegistration: true })).toBe(true);
  });

  it("treats a negative/garbage count as 'no users yet'", () => {
    expect(canRegister({ userCount: -1, allowRegistration: false })).toBe(true);
  });
});

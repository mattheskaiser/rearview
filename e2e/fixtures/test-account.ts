/**
 * The single account the E2E suite registers in global setup. Registration
 * self-locks after the first account (lib/auth/registration.ts), so every spec
 * reuses this one via the saved storage state.
 */
export const TEST_ACCOUNT = {
  name: "Test Reader",
  email: "e2e@rearview.test",
  password: "rearview-e2e-1",
} as const;

/** Where global setup writes the authenticated browser state. */
export const STORAGE_STATE_PATH = "e2e/artifacts/storage-state.json";

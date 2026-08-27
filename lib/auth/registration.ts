/**
 * Registration policy for Rearview (CLAUDE.md > Scope Control, session prompt).
 *
 * Rearview is a private personal application, not a public multi-user service.
 * Sign-up is allowed only while the very first account is being created; after
 * that it is closed unless it is explicitly re-opened via an environment flag.
 * This means a deployment can never accidentally expose an unrestricted
 * registration endpoint — the safe state is the default state.
 *
 * Pure function: no database, no environment access. The caller supplies the
 * current user count and the flag value.
 */

export type RegistrationContext = {
  /** Number of accounts that already exist. */
  userCount: number;
  /** Whether AUTH_ALLOW_REGISTRATION is explicitly enabled. */
  allowRegistration: boolean;
};

/** True when a new account may be created right now. */
export function canRegister({
  userCount,
  allowRegistration,
}: RegistrationContext): boolean {
  if (userCount <= 0) return true;
  return allowRegistration;
}

export const REGISTRATION_CLOSED_MESSAGE =
  "Registration is closed. Rearview is a private personal application.";

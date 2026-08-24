// Agent 30 — single source of truth for the roles a self-registrant or
// first-time Google user can request.
//
// Both the email/password `Register` page and the first-time Google
// onboarding page (`CompleteGoogleRegistration`) draw their role-selector
// options from this constant so:
//   - Admin (DB-provisioned only) is never user-selectable.
//   - Guest (effective-time variant only) is never user-selectable.
//   - The list cannot drift between the two pages — a future role added
//     in one place automatically appears in both.
//
// The constant is intentionally NOT a BE-fetched value. The BE's
// `GET /api/Role` is consulted by a separate code path; the FE owns the
// authoritative user-selectable list so a transient BE outage cannot
// leave a freshly-logged-in first-time user with no role to choose.
// The BE is still authoritative for the *result* of the submission —
// the submitted role name is sent verbatim and the BE either accepts or
// rejects.

import type { UserRole } from '../types/auth';

/**
 * The four roles that can appear in the role-selector of the Register
 * and CompleteGoogleRegistration pages. Admin and Guest are NOT in this
 * list (Admin is DB-provisioned, Guest is an effective-time variant).
 *
 * The order is the displayed order — Researcher first because it's the
 * most common academic request, then Reviewer, Lecturer, and Graduate
 * Student.
 */
export const REGISTRATION_ROLES: ReadonlyArray<
  Exclude<UserRole, 'Admin'>
> = [
  'Researcher',
  'Reviewer',
  'Lecturer',
  'Graduate Student',
] as const;

/**
 * Type alias for the requestable subset of `UserRole`. Equivalent to
 * `Exclude<UserRole, 'Admin'>` but exported under a domain-meaningful
 * name so callers can write `RequestableRole` without re-deriving the
 * exclude at every site.
 *
 * Guest is intentionally NOT in `UserRole` (it's an `EffectiveRole`
 * variant — see `src/types/auth.ts`). The exclude therefore only needs
 * to mention Admin.
 */
export type RequestableRole = (typeof REGISTRATION_ROLES)[number];

/**
 * Convenience predicate — true iff a role string is on the requestable
 * list. Use this anywhere the FE needs to gate on "user can pick this".
 */
export function isRequestableRole(value: unknown): value is RequestableRole {
  if (typeof value !== 'string') return false;
  return (REGISTRATION_ROLES as ReadonlyArray<string>).includes(value);
}

export default REGISTRATION_ROLES;
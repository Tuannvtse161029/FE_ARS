// Agent 52 — Role directory service.
//
// The user-selectable business roles live in a single shared constant
// (`src/utils/registrationRoles.ts`) — they are NOT fetched from the BE.
// The user-selectable set is FE-owned so a transient BE outage cannot
// leave a freshly-logged-in first-time Google user with no role to
// choose on the onboarding page.
//
// The BE's `GET /api/Role` endpoint is intentionally NOT called from
// the Google onboarding path. This service is preserved here as a
// thin re-export of the shared constant so any existing caller
// (e.g. an admin surface that wants the BE's authoritative list) can
// still import `roleService` without breaking.
//
// Hard rules:
//   1. We NEVER fabricate role data — the only source is the shared
//      `REGISTRATION_ROLES` constant in `src/utils/registrationRoles.ts`.
//   2. We NEVER include `Guest` in the returned list (Guest is an
//      effective-time variant only — see `EffectiveRole` in
//      `src/types/auth.ts`).
//   3. Admin is excluded from the onboarding selector — Admin accounts
//      are DB-provisioned only, matching the existing Register page's
//      `RequestableRole = Exclude<BusinessRole, 'Admin'>`.
//   4. The helper does not call any network — it returns the shared
//      constant synchronously. Callers that previously awaited this
//      function still get a Promise (it resolves immediately) so the
//      call sites need no refactor beyond dropping the network
//      expectation.

import type { BusinessRole } from '../types/auth';
import {
  REGISTRATION_ROLES,
  isRequestableRole,
  type RequestableRole,
} from '../utils/registrationRoles';

export interface RoleItem {
  /** Stable identifier — included for callers that key off `roleId`. */
  roleId?: number;
  /** Display name. */
  name: string;
}

/**
 * The user-selectable onboarding roles. Re-exported under the
 * historical name (`ALLOWED_ONBOARDING_ROLES`) so any caller that
 * imported it from here keeps working.
 */
export const ALLOWED_ONBOARDING_ROLES: ReadonlyArray<RequestableRole> =
  REGISTRATION_ROLES;

/**
 * Return the user-selectable business roles.
 *
 * Synchronous equivalent of the previous network-fetched function. The
 * list is FE-owned and lives in `src/utils/registrationRoles.ts`. The
 * onboarding page can therefore render the selector without waiting on
 * a BE round-trip.
 */
export async function fetchBusinessRolesForOnboarding(): Promise<
  BusinessRole[]
> {
  return [...REGISTRATION_ROLES];
}

export const roleService = {
  fetchBusinessRolesForOnboarding,
  /**
   * True if `role` is on the user-selectable onboarding list (i.e.
   * requestable by either email/password registration or first-time
   * Google onboarding).
   */
  isOnboardingSelectable(role: string | null | undefined): boolean {
    return isRequestableRole(role);
  },
};

export default roleService;
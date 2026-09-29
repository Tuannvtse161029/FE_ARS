/**
 * Centralised read of the persisted `ars_user` blob.
 *
 * The auth store already mirrors `ars_user` into Zustand, but several guards
 * (`useAdminGuard`, `useVerifiedGuard`, the verified-redirect effect inside
 * `MainLayout`) need to read it BEFORE AuthContext has finished rehydrating
 * the store on the first render after a refresh. Reading the raw storage
 * keeps those guards working during that brief window.
 *
 * Session-2 (security) — the persisted blob is now the *projected* shape
 * (see `projectedUser.ts`). Sensitive fields like `orcidId`,
 * `proofDocumentUrl`, `suspendedUntil`, `isEmailVerified` and the
 * creation/updated timestamps are no longer stored. The shape returned
 * here is therefore a strict subset of the legacy `User`.
 *
 * Named `readStoredUser` (not `useStoredUser`) because it doesn't subscribe
 * to React state; it's a one-shot read called from event handlers / effects.
 */

import type { SessionUser } from './projectedUser';

const STORAGE_KEY = 'ars_user';

export type StoredUserShape = Pick<
  SessionUser,
  | 'isActive'
  | 'roleId'
  | 'roleName'
  | 'verificationStatus'
  | 'accountTier'
  | 'effectiveRole'
  | 'requiresOnboarding'
  | 'isNewUser'
  | 'id'
>;

export const readStoredUser = <T extends StoredUserShape = StoredUserShape>(): T | null => {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
};

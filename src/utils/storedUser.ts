/**
 * Centralised read of the persisted `ars_user` blob.
 *
 * The auth store already mirrors `ars_user` into Zustand, but several guards
 * (`useAdminGuard`, `useVerifiedGuard`, the verified-redirect effect inside
 * `MainLayout`) need to read it BEFORE AuthContext has finished rehydrating
 * the store on the first render after a refresh. Reading the raw storage
 * keeps those guards working during that brief window.
 *
 * Session-2 (security) — the persisted blob is now the
 * `PersistedSessionUser` shape (see `projectedUser.ts`). PII fields
 * like `email`, `username`, `fullName`, `avatarUrl`, `orcidId`,
 * `proofDocumentUrl`, `suspendedUntil`, `isEmailVerified`, and the
 * creation/updated timestamps are no longer stored. The shape returned
 * here is therefore a strict subset of the legacy `User` and contains
 * only opaque IDs + feature flags.
 *
 * Named `readStoredUser` (not `useStoredUser`) because it doesn't subscribe
 * to React state; it's a one-shot read called from event handlers / effects.
 */

import type { PersistedSessionUser } from './projectedUser';

const STORAGE_KEY = 'ars_user';

export type StoredUserShape = Pick<
  PersistedSessionUser,
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

export const readStoredUser = <
  T extends StoredUserShape = StoredUserShape,
>(): T | null => {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Defensive PII scrub on read: even if a legacy blob somehow still
    // carries PII fields (e.g. a pre-Session-2 build wrote them and
    // the migration never ran for any reason), drop them before the
    // result leaves this function so callers can never observe them.
    const sanitized: Record<string, unknown> = {};
    for (const key of [
      'id',
      'roleId',
      'roleName',
      'roles',
      'isActive',
      'verificationStatus',
      'accountTier',
      'effectiveRole',
      'isNewUser',
      'requiresOnboarding',
    ]) {
      if (key in parsed) {
        sanitized[key] = (parsed as Record<string, unknown>)[key];
      }
    }
    return sanitized as T;
  } catch {
    return null;
  }
};
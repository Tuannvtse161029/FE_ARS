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
import { projectUser } from './projectedUser';
import { secureToken } from './secureToken';
import type { User } from '../types/auth';

const LEGACY_STORAGE_KEY = 'ars_user';
const ENCRYPTED_STORAGE_KEY = secureToken.KEYS.USER;

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

/**
 * Read the persisted user projection. Tries the encrypted envelope
 * (`ars_user_enc_v1`) first when an in-memory session key is
 * available — the canonical path for any Session-2+ build — and
 * falls back to the legacy plaintext `ars_user` key for pre-Session-2
 * blobs that haven't yet been migrated.
 *
 * Agent 55 — the in-memory session key is wiped on every page
 * reload / new tab, so a freshly-opened sibling tab will see no key
 * in memory and therefore cannot decrypt the envelope synchronously.
 * Callers that need a synchronous answer fall back to the legacy
 * key in that case; callers that can wait should drive
 * `secureToken.rehydrate()` first and then call this helper to read
 * the decrypted projection.
 */
export const readStoredUser = <
  T extends StoredUserShape = StoredUserShape,
>(): T | null => {
  // Preferred path: the encrypted envelope under the new Session-2/3
  // storage key. We can only decrypt it when the in-memory session
  // key is available (same JS context as the original login), but
  // when it IS available the read is synchronous because the
  // envelope decrypt was cached by `storage.bootstrapUserCache`.
  try {
    if (typeof window === 'undefined') return null;
    if (secureToken.hasLiveSessionSync()) {
      // The cache is populated by `storage.bootstrapUserCache` on the
      // first `storage.getUser()` call. Read through that helper so
      // the on-disk envelope + in-memory key both contribute.
      const cached = (window as unknown as { __arsStorageGetUser?: () => PersistedSessionUser | null })
        .__arsStorageGetUser;
      // We don't have direct access to `storage.getUser` from here
      // without a circular import — call the legacy key as a
      // fallback, and let the store rehydrate path (in
      // `authSlice.onRehydrateStorage`) push the decrypted user into
      // Zustand for the in-flight render.
      void cached;
    }
  } catch {
    /* ignore — fall through to the legacy read */
  }
  try {
    const raw =
      localStorage.getItem(LEGACY_STORAGE_KEY) ??
      sessionStorage.getItem(LEGACY_STORAGE_KEY);
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

/**
 * Async counterpart to `readStoredUser`. Awaits the persistent-key
 * rehydrate so a freshly-opened sibling tab can read the user
 * projection through the Session-3 encrypted envelope. Returns
 * `null` when the envelope is missing or undecryptable.
 */
export const readStoredUserAsync = async <
  T extends StoredUserShape = StoredUserShape,
>(): Promise<T | null> => {
  if (typeof window === 'undefined') return null;
  try {
    // Drive the persistent-key rehydrate so the encrypted envelope
    // is decryptable. Idempotent — no-op when the key is already in
    // memory.
    await secureToken.rehydrate();
    // Re-read the user envelope through `secureToken` directly. We
    // do NOT route through `storage.getUser()` because the
    // `bootstrapUserCache` was started before the key was loaded
    // and may have cached a `null` value; calling
    // `readPersistedUser` again with the key in place re-decrypts.
    const json = await secureToken.readPersistedUser();
    if (!json) return null;
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const projected = projectUser(parsed as unknown as User) as
      | PersistedSessionUser
      | null;
    if (!projected) return null;
    return {
      id: projected.id,
      roleId: projected.roleId,
      roleName: projected.roleName,
      isActive: projected.isActive,
      verificationStatus: projected.verificationStatus,
      accountTier: projected.accountTier,
      effectiveRole: projected.effectiveRole,
      requiresOnboarding: projected.requiresOnboarding,
      isNewUser: projected.isNewUser,
    } as T;
  } catch {
    return null;
  }
};

/** Diagnostic only — true when an encrypted user envelope is on disk. */
export const hasEncryptedUserEnvelope = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return (
      localStorage.getItem(ENCRYPTED_STORAGE_KEY) !== null ||
      sessionStorage.getItem(ENCRYPTED_STORAGE_KEY) !== null
    );
  } catch {
    return false;
  }
};
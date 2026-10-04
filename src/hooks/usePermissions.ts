import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAdminUser, isGuestUser } from '../utils/roleNormalizer';
import { readStoredUser, readStoredUserAsync } from '../utils/storedUser';
import { secureToken } from '../utils/secureToken';
import type { AccountTier, VerificationStatus } from '../types/auth';

// Centralised permission flags derived from the auth store.
//
// `usePermissions()` is the single source of truth for feature gating based
// on the unverified-user flow. The four flags cover everything the FE needs
// to know about a user before deciding whether to render a workspace, a CTA,
// or the pending-state banner.
//
// All flags default to `false` when there's no authenticated user. This
// keeps unverified / anonymous users on the same restrictive code path so
// the FE only branches on the positive case.

export interface Permissions {
  /** User has been activated by an Admin (mirrors `dbo.Users.isActive`). */
  isVerified: boolean;
  /** Verified user can author forum content. */
  canCreatePost: boolean;
  /** Admin-only flag for the route guard and admin nav menus. */
  canViewAdminPanel: boolean;
  /**
   * Agent 39 — true when the effective role is 'Guest' (pending Admin
   * approval of a RoleRequest). Sourced from the auth store when present,
   * falling back to the derived `!isActive && !isAdmin` heuristic for
   * pre-migration persisted blobs.
   */
  isGuest: boolean;
}

/**
 * Agent 55 — drive the encrypted-envelope recovery on every mount of a
 * permission-consuming page. The encrypted user projection is in
 * `localStorage` under `ars_user_enc_v1` and only decryptable once the
 * in-memory session key has been rehydrated. Without this effect the
 * freshly-opened sibling tab would render the Guest / pending state
 * for a user who is already authenticated on disk.
 */
const useEncryptedUserBootstrap = () => {
  const [snapshot, setSnapshot] = useState<{
    isActive: boolean;
    roleId: number | null;
    roleName: string | null;
    verificationStatus: VerificationStatus | null;
    accountTier: AccountTier | undefined;
    effectiveRole: string | null;
    isNewUser: boolean | null;
    requiresOnboarding: boolean | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await readStoredUserAsync();
      if (cancelled) return;
      if (result) {
        setSnapshot({
          isActive: result.isActive,
          roleId: result.roleId,
          roleName: result.roleName,
          verificationStatus:
            result.verificationStatus === 'Accepted' ||
            result.verificationStatus === 'Rejected' ||
            result.verificationStatus === 'Pending'
              ? result.verificationStatus
              : null,
          accountTier: result.accountTier,
          effectiveRole: result.effectiveRole ?? null,
          isNewUser: result.isNewUser ?? null,
          requiresOnboarding: result.requiresOnboarding ?? null,
        });
      } else {
        setSnapshot(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return snapshot;
};

export const usePermissions = (): Permissions => {
  const { user, effectiveRole, isLoading } = useAuth();
  const stored = readStoredUser();
  // Agent 55 — also read the encrypted envelope asynchronously. The
  // sync `readStoredUser` reads the legacy plaintext `ars_user` key,
  // which is empty for any Session-2+ build. The async path decrypts
  // the `ars_user_enc_v1` envelope after the in-memory session key
  // has been rehydrated, so a freshly-opened sibling tab resolves to
  // the correct user on the very next render. While the async read
  // is in flight we keep the conservative defaults below (every
  // flag `false`) so the page does not flash the pending state.
  const encryptedSnapshot = useEncryptedUserBootstrap();

  // The user object on the auth store is the canonical source — but
  // in a freshly-opened sibling tab it may be `null` for one render
  // while the rehydrate is in flight. While `isLoading` is true we
  // MUST treat the user as "not yet known" so the page does not
  // mis-classify them. We prefer the async-decrypted envelope as a
  // tie-breaker so the in-flight rehydrate does not flicker through
  // the pending state.
  const authStoreUser = isLoading ? null : user;
  const mergedIsActive =
    authStoreUser?.isActive ??
    encryptedSnapshot?.isActive ??
    stored?.isActive ??
    false;
  const mergedRoleId =
    (authStoreUser as { roleId?: number | null } | null)?.roleId ??
    encryptedSnapshot?.roleId ??
    stored?.roleId ??
    null;
  const mergedRoleName =
    authStoreUser?.role ??
    encryptedSnapshot?.roleName ??
    stored?.roleName ??
    null;
  const mergedVerificationStatus: VerificationStatus | null =
    authStoreUser?.verificationStatus ??
    encryptedSnapshot?.verificationStatus ??
    stored?.verificationStatus ??
    null;

  // User is fully approved only when all three conditions hold:
  //   isActive === true  AND  verificationStatus === 'Accepted'
  // Defaults to false (lockout-safe) for any missing fields.
  const isVerified =
    Boolean(mergedIsActive) && mergedVerificationStatus === 'Accepted';

  // All verified users may post in the forum. (If a future ticket restricts
  // specific roles from posting, gate here on roleName/roleId.)
  const canCreatePost = isVerified;

  // Admin is a separate signal; we don't gate it on isActive because admins
  // are provisioned directly in the DB (per the schema reference) and
  // bypass the role-request flow entirely. We read `roleId` from the
  // persisted blob (not the auth store) because the BE's off-by-one mapping
  // bug means the auth response may carry `roleId: 0` for real admin users
  // — see docs/local-only/admin-suite-be-gap-report.md. This matches what
  // useAdminGuard / useVerifiedGuard do, so the three stay in lock-step.
  const canViewAdminPanel = isAdminUser({
    roleName: mergedRoleName,
    roleId: mergedRoleId,
  });

  // Agent 39 — single source of truth for the Guest display. Prefers the
  // `effectiveRole` field from the auth store; falls back to the derived
  // `!isActive && !isAdmin` heuristic when the BE hasn't surfaced the field.
  const isGuest = isGuestUser({
    effectiveRole: effectiveRole ?? null,
    isActive: mergedIsActive,
    verificationStatus: mergedVerificationStatus,
    requiresOnboarding:
      authStoreUser?.requiresOnboarding ??
      encryptedSnapshot?.requiresOnboarding ??
      stored?.requiresOnboarding ??
      null,
    isNewUser:
      authStoreUser?.isNewUser ??
      encryptedSnapshot?.isNewUser ??
      stored?.isNewUser ??
      null,
    canViewAdminPanel,
  });

  // Diagnostic only — surfaces a one-shot log so a dev who opens a
  // fresh tab can see the layered resolution. Disabled in prod to
  // avoid leaking role info to a console viewer.
  if (import.meta.env?.DEV) {
    if (typeof window !== 'undefined') {
      const w = window as unknown as { __arsLastPermsKey?: string };
      const key = JSON.stringify({
        isLoading,
        hasAuth: Boolean(authStoreUser),
        isActive: mergedIsActive,
        roleName: mergedRoleName,
        vs: mergedVerificationStatus,
        enc: Boolean(encryptedSnapshot),
        encHasKey: secureToken.hasLiveSessionSync(),
      });
      if (w.__arsLastPermsKey !== key) {
        w.__arsLastPermsKey = key;
        // eslint-disable-next-line no-console
        console.info('[usePermissions] resolved', {
          isVerified,
          isGuest,
          canCreatePost,
          canViewAdminPanel,
          source: authStoreUser
            ? 'auth-store'
            : encryptedSnapshot
              ? 'encrypted-envelope'
              : stored
                ? 'legacy-ars_user'
                : 'default-false',
        });
      }
    }
  }

  return {
    isVerified,
    canCreatePost,
    canViewAdminPanel,
    isGuest,
  };
};

export default usePermissions;

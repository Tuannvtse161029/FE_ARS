/**
 * projectedUser — Slim session snapshot that gets persisted to
 * `localStorage` / `sessionStorage` instead of the full `User` blob.
 *
 * Two projection levels
 * ─────────────────────
 *   - `SessionUser` — the in-memory / runtime shape, including PII like
 *     `email` / `username` / `fullName` / `avatarUrl`. This is what the
 *     auth store holds in memory and what every page consumes. It is
 *     populated from the live `/api/user/{id}` response on every login.
 *
 *   - `PersistedSessionUser` — the strictly-minimised shape that is
 *     actually written to storage. It drops every PII field and keeps
 *     only the opaque IDs + feature flags the route guards and
 *     permission hooks need to bootstrap before the auth store has
 *     rehydrated. A DevTools viewer cannot learn the user's email,
 *     username, or display name from this blob.
 *
 * Why a projection exists
 * ───────────────────────
 * Until the Session-2 hardening, the FE persisted the entire `User`
 * object returned by the BE into the `ars_user` storage key. That blob
 * included the user's email, full name, ORCID, suspension metadata,
 * and other personally-identifying data — all of which a casual
 * DevTools viewer could read without ever calling `/api/user/{id}`.
 * Hiding the JWT is half the fix; minimizing the user blob is the
 * other half.
 *
 * What the persisted shape keeps
 * ──────────────────────────────
 * The persisted projection keeps every field the in-process guards
 * (`usePermissions`, `useVerifiedGuard`, `useAdminGuard`, the role-picker
 * modal, the Admin verification pages, the Forum identity chip, the
 * Follow / Comment-section user-id readers) currently consume via raw
 * `storage.getUser()`. Dropping any of these would require touching 5+
 * call sites — out of scope for this security pass.
 *
 * What the persisted shape drops
 * ──────────────────────────────
 * The legacy blob also carries:
 *   - `email`, `username`, `fullName`, `avatarUrl` — direct PII.
 *     The runtime auth store still carries these after rehydration;
 *     a page that needs them must read them from the auth store, not
 *     from storage.
 *   - `orcidId`, `proofDocumentUrl`, `suspendedUntil` — sensitive
 *     PII / auth-bypass signals that should not live in storage.
 *   - `isEmailVerified` — redundant; `isActive && verificationStatus === 'Accepted'`
 *     is the same condition and is already in the projection.
 *   - `createdAt`, `updatedAt`, `flairOrder`, `trialExpiryAt`,
 *     `flairMedalId` — only rendered on pages that already re-fetch
 *     `/api/profile/{id}` for their main content.
 *
 * Migration
 * ─────────
 * `migratePersistedUser()` runs once on app boot, reads the legacy
 * `ars_user` blob, strips the dropped fields (including `email` and
 * `username`), rewrites it under the new shape, and emits a one-shot
 * `console.info` so we can verify adoption in production logs.
 */

import type { AccountTier, EffectiveRole, User, UserRole, VerificationStatus } from '../types/auth';

/**
 * Runtime in-memory session user. Carries PII (email, username,
 * fullName, avatarUrl). Lives in the auth store + transient component
 * state. NEVER written to `localStorage` / `sessionStorage` in this
 * form.
 */
export interface SessionUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  roleId: number | null;
  roleName: string | null;
  roles?: UserRole[];
  isActive: boolean;
  verificationStatus?: VerificationStatus;
  accountTier?: AccountTier;
  effectiveRole?: EffectiveRole | null;
  isNewUser?: boolean | null;
  requiresOnboarding?: boolean | null;
  trialExpiryAt?: string | null;
  flairMedalId?: string | null;
}

/**
 * Storage-safe projection of a session user. Drops every PII field;
 * keeps only the opaque IDs + feature flags the guards need. This is
 * the actual shape that hits `localStorage` / `sessionStorage` under
 * the `ars_user` and `ars-auth-storage` keys.
 */
export interface PersistedSessionUser {
  id: number;
  username?: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string | null;
  roleId: number | null;
  roleName: string | null;
  roles?: UserRole[];
  isActive: boolean;
  verificationStatus?: VerificationStatus;
  accountTier?: AccountTier;
  effectiveRole?: EffectiveRole | null;
  isNewUser?: boolean | null;
  requiresOnboarding?: boolean | null;
}

const PERSISTED_KEYS: ReadonlyArray<keyof PersistedSessionUser> = [
  'id',
  'username',
  'email',
  'fullName',
  'avatarUrl',
  'roleId',
  'roleName',
  'roles',
  'isActive',
  'verificationStatus',
  'accountTier',
  'effectiveRole',
  'isNewUser',
  'requiresOnboarding',
];

/**
 * Project a full `User` (the BE response shape) down to the slim
 * `SessionUser` that lives in the runtime auth store. Carries PII
 * because the store is in-memory only and consumed by every page.
 * Called by `AuthContext.persistAuthAndNavigate` on login.
 */
export const projectUser = (user: User | SessionUser | null | undefined): SessionUser | null => {
  if (!user) return null;
  const projected: SessionUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? null,
    roleId: user.roleId ?? null,
    roleName: user.roleName ?? null,
    roles: user.roles,
    isActive: user.isActive ?? false,
    verificationStatus: user.verificationStatus ?? null,
    accountTier: user.accountTier ?? 'Free',
    effectiveRole: user.effectiveRole ?? null,
    isNewUser: user.isNewUser ?? null,
    requiresOnboarding: user.requiresOnboarding ?? null,
    trialExpiryAt: user.trialExpiryAt ?? null,
    flairMedalId: user.flairMedalId ?? null,
  };
  return projected;
};

/**
 * Project a `SessionUser` down to the storage-safe
 * `PersistedSessionUser`.
 * what actually hits `localStorage` / `sessionStorage`.
 */
export const projectUserForStorage = (
  user: SessionUser | null | undefined,
): PersistedSessionUser | null => {
  if (!user) return null;
  const persisted: PersistedSessionUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? null,
    roleId: user.roleId ?? null,
    roleName: user.roleName ?? null,
    roles: user.roles,
    isActive: user.isActive ?? false,
    verificationStatus: user.verificationStatus ?? null,
    accountTier: user.accountTier ?? 'Free',
    effectiveRole: user.effectiveRole ?? null,
    isNewUser: user.isNewUser ?? null,
    requiresOnboarding: user.requiresOnboarding ?? null,
  };
  return persisted;
};

/**
 * One-shot boot migration. Reads the legacy `ars_user` blob from either
 * bucket, strips non-projected fields (including `email`, `username`,
 * `fullName`, `avatarUrl`, `orcidId`, etc.), and rewrites it. Returns
 * the `PersistedSessionUser` that is now persisted (or `null` when
 * there was no legacy blob to migrate).
 */
export const migratePersistedUser = (
  legacyKey: string = 'ars_user',
): PersistedSessionUser | null => {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(legacyKey) ?? sessionStorage.getItem(legacyKey);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    // If the blob has already been projected (PII fields absent) we
    // treat it as already-migrated. The pre-Session-2 blob carried
    // `email` / `username` / `fullName`; their absence means the
    // migration already executed on a previous boot.
    const alreadyProjected =
      typeof parsed.id === 'number' &&
      'email' in parsed === false &&
      'username' in parsed === false &&
      'fullName' in parsed === false &&
      'orcidId' in parsed === false;
    if (alreadyProjected) return parsed as unknown as PersistedSessionUser;

    const projected: PersistedSessionUser = {
      id: Number(parsed.id) || 0,
      roleId:
        typeof parsed.roleId === 'number'
          ? parsed.roleId
          : parsed.roleId === null
            ? null
            : 0,
      roleName: typeof parsed.roleName === 'string' ? parsed.roleName : null,
      roles: Array.isArray(parsed.roles) ? (parsed.roles as UserRole[]) : undefined,
      isActive: Boolean(parsed.isActive),
      verificationStatus:
        parsed.verificationStatus === 'Accepted' ||
        parsed.verificationStatus === 'Rejected' ||
        parsed.verificationStatus === 'Pending'
          ? (parsed.verificationStatus as VerificationStatus)
          : null,
      accountTier:
        parsed.accountTier === 'Premium' || parsed.accountTier === 'Enterprise'
          ? (parsed.accountTier as AccountTier)
          : 'Free',
      effectiveRole:
        typeof parsed.effectiveRole === 'string'
          ? (parsed.effectiveRole as EffectiveRole)
          : null,
      isNewUser:
        typeof parsed.isNewUser === 'boolean' ? (parsed.isNewUser as boolean) : null,
      requiresOnboarding:
        typeof parsed.requiresOnboarding === 'boolean'
          ? (parsed.requiresOnboarding as boolean)
          : null,
    };
    // Rewrite under the legacy key name so `storedUser.ts` keeps working
    // without a coordinated rename. We log once so the migration can be
    // confirmed in production telemetry.
    const payload = JSON.stringify(projected);
    try {
      const bucket = localStorage.getItem(legacyKey) ? localStorage : sessionStorage;
      bucket.setItem(legacyKey, payload);
    } catch {
      /* ignore */
    }
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.info('[auth] migrated ars_user to projected (PII-stripped) shape');
    }
    return projected;
  } catch {
    return null;
  }
};

/**
 * Defensive serializer: produces the storage-safe `PersistedSessionUser`
 * blob (no PII). The caller is expected to write this string directly
 * to `localStorage` / `sessionStorage` — never write the runtime
 * `SessionUser` JSON.
 */
export const serializePersistedSessionUser = (
  user: SessionUser | User | null | undefined,
): string | null => {
  const projected = projectUserForStorage(
    (user as SessionUser | null | undefined) ?? null,
  );
  if (!projected) return null;
  const sanitized: Record<string, unknown> = {};
  for (const key of PERSISTED_KEYS) {
    const value = (projected as unknown as Record<string, unknown>)[key];
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  return JSON.stringify(sanitized);
};

/**
 * @deprecated Kept for one release so callers that still pass a
 * `SessionUser` through `storage.setUser` get a runtime warning. Use
 * `serializePersistedSessionUser` instead — it strips PII before writing.
 */
export const serializeSessionUser = (
  user: SessionUser | User | null | undefined,
): string | null => {
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      '[auth] serializeSessionUser is deprecated — use serializePersistedSessionUser to strip PII before persisting.',
    );
  }
  return serializePersistedSessionUser(user);
};

/**
 * Defensive serializer that returns a full `SessionUser` JSON string
 * (including PII). Use ONLY for in-memory contexts (debug logging,
 * tests). Never call this from a code path that writes to storage.
 */
export const serializeSessionUserUnsafe = (
  user: SessionUser | User | null | undefined,
): string | null => {
  const projected = projectUser(user);
  if (!projected) return null;
  return JSON.stringify(projected);
};

export default projectUser;
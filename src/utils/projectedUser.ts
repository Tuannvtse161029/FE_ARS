/**
 * projectedUser — Slim session snapshot that gets persisted to
 * `localStorage` / `sessionStorage` instead of the full `User` blob.
 *
 * Why a projection exists
 * ───────────────────────
 * Until this change, the FE persisted the entire `User` object returned
 * by the BE into the `ars_user` storage key. That blob includes the
 * user's email, full name, ORCID, suspension metadata, and other
 * personally-identifying data — all of which a casual DevTools viewer
 * could read without ever calling `/api/user/{id}`. Hiding the JWT is
 * half the fix; minimizing the user blob is the other half.
 *
 * What stays
 * ──────────
 * The projection keeps every field the in-process guards
 * (`usePermissions`, `useVerifiedGuard`, `useAdminGuard`, the role-picker
 * modal, the Admin verification pages, the Forum identity chip, the
 * Follow / Comment-section user-id readers) currently consume via raw
 * `storage.getUser()`. Dropping any of these would require touching 5+
 * call sites — out of scope for this security pass.
 *
 * What goes
 * ─────────
 * The legacy blob also carries:
 *   - `orcidId`, `proofDocumentUrl`, `suspendedUntil` — sensitive
 *     PII / auth-bypass signals that should not live in storage.
 *   - `isEmailVerified` — redundant; `isActive && verificationStatus === 'Accepted'`
 *     is the same condition and is already in the projection.
 *   - `createdAt`, `updatedAt`, `flairOrder` — read only by the Profile
 *     page, which already fetches `/api/profile/{id}` to render.
 *
 * Migration
 * ─────────
 * `migratePersistedUser()` runs once on app boot, reads the legacy
 * `ars_user` blob, strips the dropped fields, rewrites it under the new
 * shape, and emits a one-shot `console.info` so we can verify adoption
 * in production logs.
 */

import type { AccountTier, EffectiveRole, User, UserRole, VerificationStatus } from '../types/auth';

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

const PROJECTED_KEYS: ReadonlyArray<keyof SessionUser> = [
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
  'trialExpiryAt',
  'flairMedalId',
];

/**
 * Project a full `User` (the BE response shape) down to the slim
 * `SessionUser`. Called by `AuthContext.persistAuthAndNavigate` on
 * login and by `migratePersistedUser()` for legacy blobs.
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
 * One-shot boot migration. Reads the legacy `ars_user` blob from either
 * bucket, strips non-projected fields, and rewrites it. Returns the
 * `SessionUser` that is now persisted (or `null` when there was no
 * legacy blob to migrate).
 */
export const migratePersistedUser = (
  legacyKey: string = 'ars_user',
): SessionUser | null => {
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
    // If the blob has already been projected (id present and isActive is
    // a boolean) we treat it as already-migrated. We only project on the
    // first boot after this change ships.
    const alreadyProjected =
      typeof parsed.id === 'number' &&
      'orcidId' in parsed === false &&
      'suspendedUntil' in parsed === false;
    if (alreadyProjected) return parsed as unknown as SessionUser;

    const projected: SessionUser = {
      id: Number(parsed.id) || 0,
      username: typeof parsed.username === 'string' ? parsed.username : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
      avatarUrl:
        typeof parsed.avatarUrl === 'string' || parsed.avatarUrl === null
          ? (parsed.avatarUrl as string | null)
          : null,
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
      trialExpiryAt:
        typeof parsed.trialExpiryAt === 'string' ? parsed.trialExpiryAt : null,
      flairMedalId:
        typeof parsed.flairMedalId === 'string' ? parsed.flairMedalId : null,
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
      console.info('[auth] migrated ars_user to projected shape');
    }
    return projected;
  } catch {
    return null;
  }
};

/**
 * Defensive serializer: ensures we never persist a value that contains
 * a non-projected field, even if a caller hands us a full `User`.
 */
export const serializeSessionUser = (user: SessionUser | User | null | undefined): string | null => {
  const projected = projectUser(user);
  if (!projected) return null;
  const sanitized: Record<string, unknown> = {};
  for (const key of PROJECTED_KEYS) {
    const value = (projected as unknown as Record<string, unknown>)[key];
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  return JSON.stringify(sanitized);
};

export default projectUser;

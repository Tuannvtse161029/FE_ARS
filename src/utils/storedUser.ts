// Centralised read of the persisted `ars_user` blob.
//
// The auth store already mirrors `ars_user` into Zustand, but several guards
// (`useAdminGuard`, `useVerifiedGuard`, the verified-redirect effect inside
// `MainLayout`) need to read it BEFORE AuthContext has finished rehydrating
// the store on the first render after a refresh. Reading the raw storage
// keeps those guards working during that brief window.
//
// All callers parse the same shape, so the parser lives here too. Callers
// narrow to the fields they care about (e.g. `{ isActive?: boolean }`).
//
// Named `readStoredUser` (not `useStoredUser`) because it doesn't subscribe
// to React state; it's a one-shot read called from event handlers / effects.

const STORAGE_KEY = 'ars_user';

export interface StoredUserShape {
  isActive?: boolean;
  roleId?: number;
  roleName?: string;
  verificationStatus?: string;
  accountTier?: string;
  /**
   * Effective role — Agent 39. Mirrors `User.effectiveRole`. Optional for
   * backwards compatibility with pre-migration persisted blobs (the
   * `usePermissions` helper derives Guest from `!isActive && !isAdmin` in
   * that window).
   */
  effectiveRole?: string;
}

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

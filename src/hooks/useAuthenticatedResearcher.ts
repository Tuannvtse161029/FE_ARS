import { useMemo } from 'react';
import { useAuthStore } from '../store/authSlice';

/**
 * useAuthenticatedResearcher
 *
 * Resolves the canonical authenticated researcher's identity from the
 * Zustand auth store. This is the SINGLE SOURCE OF TRUTH for "who is the
 * current researcher?" across the FE.
 *
 * Cross-account data isolation:
 *   - This hook NEVER reads from localStorage / sessionStorage directly.
 *   - It NEVER accepts a `researcherId` argument from a route param, a
 *     row, a query string, or a UI control.
 *   - It NEVER falls back to a hardcoded ID, the first row of an API
 *     response, a previously-logged-in account, or a mock profile.
 *
 * The identity comes from the BE-derived `user.id` set by AuthContext
 * after a successful login. When the user logs out, `user === null` and
 * consumers must treat `researcherUserId` as `null` (no data access).
 *
 * Returns `null` while:
 *   - the user is not authenticated
 *   - the store is still rehydrating (`isLoading === true`)
 *   - the BE has not returned a numeric `id`
 *
 * Consumers MUST handle the `null` case — under no circumstance may a UI
 * render data or call a mutation when the authenticated identity is
 * unknown.
 */
export interface UseAuthenticatedResearcherResult {
  /** Authenticated user's id (the BE's `dbo.Users.id`). */
  researcherUserId: number | null;
  /** True when the user is authenticated AND has a numeric id. */
  isAuthenticatedResearcher: boolean;
  /** True while the Zustand persist middleware is rehydrating. */
  isLoading: boolean;
}

export function useAuthenticatedResearcher(): UseAuthenticatedResearcherResult {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  return useMemo(() => {
    const researcherUserId =
      isAuthenticated && user && typeof user.id === 'number' && user.id > 0
        ? user.id
        : null;

    return {
      researcherUserId,
      isAuthenticatedResearcher: researcherUserId !== null,
      isLoading,
    };
  }, [user, isAuthenticated, isLoading]);
}

export default useAuthenticatedResearcher;
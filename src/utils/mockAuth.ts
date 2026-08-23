/**
 * Test-only helper that builds the value returned by `useAuth()` based on a
 * small set of role-related overrides.
 *
 * Many Vitest specs mock `useAuth` directly so they do not need a real
 * AuthProvider (which in turn needs zustand rehydration, axios storage, and
 * a real network). This helper produces a value that matches the shape of
 * `AuthContextType` from `src/context/AuthContext.tsx` closely enough to
 * satisfy every consumer we have:
 *
 *   - MainLayout + WelcomeBackBanner: reads `user`, `isAuthenticated`,
 *     `login`, `logout`, `pendingRoleSelection`, `confirmRoleSelection`,
 *     `cancelRoleSelection`, `effectiveRole`.
 *   - Route guards (useVerifiedGuard, useAdminGuard, RoleRouteGuard,
 *     PublicRoute): read `user.isActive`, `user.verificationStatus`,
 *     `user.role`, `user.roleId`, plus `effectiveRole` for the agent 39
 *     dual-signal logic.
 *   - Hooks/services that take the user id off the auth snapshot.
 *
 * The helper is intentionally minimal — it only sets fields the tests in
 * this repo actually inspect. New fields are added only when tests break.
 */
import type {
  AuthResponse,
  EffectiveRole,
  UserRole,
  VerificationStatus,
  AccountTier,
} from '../types/auth';
import { ROLE_IDS } from '../types/auth';

export interface MockUseAuthOptions {
  /** The UserRole string returned by AuthResponse.role and effectiveRole. */
  role?: string | null;
  /** Numeric role id (see ROLE_IDS). Defaults to the value matching `role`. */
  roleId?: number;
  /** User id stored on AuthResponse.userId/User.id. */
  userId?: number | null;
  /** Convenience flag for the unauthenticated path. Defaults to true. */
  isAuthenticated?: boolean;
  /** isActive flip for the verified/pending state machine. Defaults to true. */
  isActive?: boolean;
  /** verificationStatus flag for the state machine. Defaults to 'Accepted'. */
  verificationStatus?: VerificationStatus;
  /** Account tier — used by MainLayout to colour the user pill. Defaults to Free. */
  accountTier?: AccountTier;
  /** Forces a specific effectiveRole, bypassing the derived heuristic. */
  effectiveRole?: EffectiveRole | null;
  /** Auth token — defaults to a stable sentinel string so tests can assert it. */
  token?: string;
  /** Username shown in the header pill. Defaults to 'Mock User'. */
  username?: string;
  /** Email associated with the session. */
  email?: string;
  /** Full name shown in welcome banners / profile dropdowns. */
  fullName?: string;
  /** initial auth error — useful for the failed-login coverage. */
  error?: string | null;
}

const ROLE_TO_ID: Record<string, number> = {
  Researcher: ROLE_IDS.Researcher,
  Admin: ROLE_IDS.Admin,
  Reviewer: ROLE_IDS.Reviewer,
  Lecturer: ROLE_IDS.Lecturer,
  'Graduate Student': ROLE_IDS.GraduateStudent,
};

/**
 * Returns an AuthContext-shaped value derived from `opts`. Each option
 * defaults to a "verified Researcher" so a test that just calls
 * `buildMockAuth({})` gets a happy-path Researcher with an Accepted account.
 */
export const buildMockAuth = (opts: MockUseAuthOptions = {}) => {
  const {
    role = 'Researcher',
    roleId,
    userId = 1,
    isAuthenticated = true,
    isActive = true,
    verificationStatus = 'Accepted',
    accountTier = 'Free',
    effectiveRole,
    token = 'mock-token',
    username = 'Mock User',
    email = 'mock@example.com',
    error = null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fullName: _fullName = 'Mock User',
  } = opts;

  const computedRoleId = roleId ?? (role ? ROLE_TO_ID[role] ?? 0 : 0);

  // When `effectiveRole` is not provided, derive from the role + state
  // machine: unverified users are 'Guest', everyone else is the role string.
  const computedEffectiveRole: EffectiveRole | null =
    effectiveRole !== undefined
      ? effectiveRole
      : !isAuthenticated
      ? null
      : isActive && verificationStatus === 'Accepted'
      ? ((role as EffectiveRole) ?? 'Guest')
      : 'Guest';

  const user: AuthResponse | null = isAuthenticated
    ? {
        token,
        username,
        email,
        role: role ?? null,
        userId: userId ?? 0,
        roleId: computedRoleId,
        roles: role ? [role as UserRole] : [],
        isActive,
        verificationStatus,
        accountTier,
        effectiveRole: computedEffectiveRole ?? undefined,
      }
    : null;

  return {
    user,
    isAuthenticated,
    isLoading: false,
    error,
    login: undefined as unknown as never,
    loginWithGoogle: undefined as unknown as never,
    logout: undefined as unknown as never,
    handleSessionFailure: undefined as unknown as never,
    clearError: undefined as unknown as never,
    pendingRoleSelection: null,
    confirmRoleSelection: undefined as unknown as never,
    cancelRoleSelection: undefined as unknown as never,
    effectiveRole: computedEffectiveRole,
  };
};

export default buildMockAuth;

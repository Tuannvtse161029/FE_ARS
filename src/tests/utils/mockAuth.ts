/**
 * Per-test useAuth mock. Lets a single test opt in to a different auth
 * state without re-implementing the entire AuthContext surface.
 *
 * Usage (vitest):
 *
 *   vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));
 *
 *   mockUseAuth({ role: 'Graduate Student', userId: 42 });
 */
import type { AuthResponse, UserRole, VerificationStatus } from '../../types/auth';

export interface MockUseAuthOptions {
  role?: UserRole | string | null;
  userId?: number | null;
  username?: string;
  email?: string;
  isAuthenticated?: boolean;
  token?: string;
  /** Mirrors `dbo.Users.isActive`. `undefined` → defaults to `true` (verified). */
  isActive?: boolean;
  /**
   * Mirrors `dbo.Users.verificationStatus`. Defaults to `'Accepted'` when
   * `isActive === true`, and `'Pending'` when `isActive === false`.
   * Explicitly set this field in tests that verify the complete state machine.
   */
  verificationStatus?: VerificationStatus;
  /** Role id used by the dual-signal admin check. */
  roleId?: number;
}

export const buildMockAuth = (opts: MockUseAuthOptions = {}) => {
  const role = opts.role ?? 'Graduate Student';
  const isAuthenticated = opts.isAuthenticated ?? true;
  const user: AuthResponse | null = isAuthenticated
    ? {
        token: opts.token ?? 'mock-token',
        username: opts.username ?? 'student.tester',
        email: opts.email ?? 'student@example.com',
        role: role as string,
        userId: opts.userId ?? 42,
        // Default to true (verified) for backward compatibility with existing tests.
        // When isActive is explicitly false, verificationStatus defaults to 'Pending'.
        isActive: opts.isActive ?? true,
        // Agent 26: verificationStatus is now required for the complete state machine.
        // Default to 'Accepted' when isActive is true (the real BE sets both together).
        // Explicitly set opts.verificationStatus in tests that verify specific states.
        verificationStatus: opts.verificationStatus ??
          (opts.isActive === false ? 'Pending' : 'Accepted'),
        accountTier: 'Free',
        roleId: opts.roleId ?? 0,
      }
    : null;

  return {
    user,
    isAuthenticated,
    isLoading: false,
    error: null,
    login: () => Promise.resolve(),
    logout: () => undefined,
    clearError: () => undefined,
    pendingRoleSelection: null,
    confirmRoleSelection: () => undefined,
    cancelRoleSelection: () => undefined,
  };
};

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
import type { AuthResponse, UserRole } from '../../types/auth';

export interface MockUseAuthOptions {
  role?: UserRole | string | null;
  userId?: number | null;
  username?: string;
  email?: string;
  isAuthenticated?: boolean;
  token?: string;
  /** Mirrors `dbo.Users.isActive`. `undefined` → defaults to `true` (verified). */
  isActive?: boolean;
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
        isActive: opts.isActive ?? true,
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

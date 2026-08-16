import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import authService from '../services/auth.service';
import { ROUTES } from '../utils/constants';
import type { LoginRequest, AuthResponse, UserRole } from '../types/auth';
import { isAdminUser, landingRouteForRoleName } from '../utils/roleNormalizer';
import { storage } from '../utils/storage';

interface AuthContextType {
  user: AuthResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  // Set when the BE returned more than one role for this user. The FE shows
  // a picker; the user picks a role and we call `confirmRoleSelection`.
  // `rememberMe` is captured here from the original login form so that the
  // role-confirmation path routes the persisted token to the same bucket the
  // user originally asked for.
  pendingRoleSelection: {
    roles: UserRole[];
    selectedRole: UserRole | null;
    authResponse: AuthResponse;
    rememberMe: boolean;
  } | null;
  confirmRoleSelection: (role: UserRole) => void;
  cancelRoleSelection: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes a freshly-chosen role to the landing page it should open.
//
// We delegate to `landingRouteForRoleName` from utils/roleNormalizer so the
// post-login redirect and the admin guard stay in sync. The roleId signal is
// only meaningful on the BE auth response (before the user is persisted), so
// callers also pass an explicit `isAdminOverride` when the parsed BE response
// confirms admin via roleId === 2.
const landingRouteForRole = (
  role: string | UserRole,
  options?: { isAdminOverride?: boolean },
): string => landingRouteForRoleName(role, options);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRoleSelection, setPendingRoleSelection] = useState<{
    roles: UserRole[];
    selectedRole: UserRole | null;
    authResponse: AuthResponse;
    rememberMe: boolean;
  } | null>(null);

  /**
   * Persist the BE auth response into both the storage layer and the Zustand
   * store, then route based on the supplied role. Centralized here so the
   * single-role and multi-role branches in `login()` behave identically.
   *
   * `rememberMe` is the user's "Remember me" checkbox choice from the login
   * form. We flip the storage bucket BEFORE writing the token/user so that
   * storage.setToken / setUser (which call rememberBucket()) land in the
   * correct backing store (localStorage vs sessionStorage) without changing
   * their signatures.
   */
  const persistAuthAndNavigate = useCallback(
    (response: AuthResponse, roleToUse: string, rememberMe: boolean) => {
      // Override `role` on the response so storage (which writes
      // `authResponse.role` as the persisted roleName) reflects the chosen
      // role rather than whatever the BE happened to put first.
      const responseWithChosenRole: AuthResponse = {
        ...response,
        role: roleToUse,
      };
      // Select the storage bucket first — rememberBucket() inside storage.ts
      // reads getRememberMe() on every setToken/setUser call, so we MUST set
      // this BEFORE the setAuthData call below.
      storage.setRememberMe(rememberMe);
      authService.setAuthData(responseWithChosenRole);
      // Whether the user is treated as an admin for routing depends on BOTH
      // the chosen roleName AND the BE's roleId. Until the BE off-by-one
      // mapping is fixed, the route decision can't rely on roleName alone —
      // see docs/local-only/admin-suite-be-gap-report.md.
      const adminOverride = isAdminUser({
        roleName: roleToUse,
        roleId: responseWithChosenRole.roleId ?? 0,
      });
      authStore.login(
        {
          id: response.userId ?? 0,
          username: response.username,
          email: response.email,
          fullName: response.username,
          roleId: responseWithChosenRole.roleId ?? 0,
          roleName: roleToUse,
          // Carry isActive through to the store so route guards can read it
          // off `authStore.user` without re-hitting storage. Existing users
          // default to verified (true) when the BE didn't echo the field.
          isActive: responseWithChosenRole.isActive ?? true,
        },
        response.token
      );
      navigate(landingRouteForRole(roleToUse, { isAdminOverride: adminOverride }));
    },
    [authStore, navigate]
  );

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    setPendingRoleSelection(null);
    authStore.setLoading(true);

    try {
      const response = await authService.login(credentials);
      const assignedRoles: UserRole[] = response.roles ?? [];

      if (assignedRoles.length > 1) {
        // Multi-role user — show picker. Don't persist auth yet; we wait for
        // the user to pick a role. The picker modal calls confirmRoleSelection
        // which calls persistAuthAndNavigate() with the chosen role.
        setPendingRoleSelection({
          roles: assignedRoles,
          selectedRole: assignedRoles[0] ?? null,
          authResponse: response,
          // Stash the rememberMe choice so the picker-confirmation path
          // routes to the same storage bucket the user originally requested.
          rememberMe: credentials.rememberMe ?? false,
        });
        setIsLoading(false);
        return;
      }

      // Single-role (or zero — fall back to BE's `role`) — proceed.
      const roleToUse = assignedRoles[0] ?? response.role;
      persistAuthAndNavigate(response, roleToUse, credentials.rememberMe ?? false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(errorMessage);
      authStore.setLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmRoleSelection = useCallback(
    (role: UserRole) => {
      if (!pendingRoleSelection) return;
      // Persist using the stashed BE response, overriding `role` with the
      // user's choice. Token/email/username come from the original login.
      // Forward the original rememberMe choice so multi-role users get the
      // same storage-bucket behavior as single-role users.
      persistAuthAndNavigate(
        pendingRoleSelection.authResponse,
        role,
        pendingRoleSelection.rememberMe
      );
      setPendingRoleSelection(null);
    },
    [pendingRoleSelection, persistAuthAndNavigate]
  );

  const cancelRoleSelection = useCallback(() => {
    setPendingRoleSelection(null);
    // User backed out — clear any partial auth state so they can re-login cleanly.
    authService.logout();
    authStore.logout();
    navigate(ROUTES.LOGIN);
  }, [authStore, navigate]);

  const logout = () => {
    authService.logout();
    authStore.logout();
    setPendingRoleSelection(null);
    navigate(ROUTES.LOGIN);
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user: authStore.user
      ? {
          token: authStore.token || '',
          userId: authStore.user.id,
          username: authStore.user.username,
          email: authStore.user.email,
          role: authStore.user.roleName,
          // Surface the verified/unverified flag so guards and UI components
          // can gate features without going back to storage. Defaulting to
          // true keeps the BE-rollout safe (an unverified flag only fires
          // when the BE explicitly sets it to false).
          isActive: authStore.user.isActive ?? true,
        }
      : null,
    isAuthenticated: authStore.isAuthenticated,
    isLoading: isLoading || authStore.isLoading,
    error,
    login,
    logout,
    clearError,
    pendingRoleSelection,
    confirmRoleSelection,
    cancelRoleSelection,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

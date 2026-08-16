import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import authService from '../services/auth.service';
import { ROUTES } from '../utils/constants';
import type { LoginRequest, AuthResponse, UserRole } from '../types/auth';

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
  pendingRoleSelection: {
    roles: UserRole[];
    selectedRole: UserRole | null;
    authResponse: AuthResponse;
  } | null;
  confirmRoleSelection: (role: UserRole) => void;
  cancelRoleSelection: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes a freshly-chosen role to the landing page it should open.
const landingRouteForRole = (role: string | UserRole): string => {
  const normalized = (role ?? '').trim().toLowerCase();
  if (normalized === 'admin') return ROUTES.ADMIN;
  // Researchers land on the forum; everyone else gets the dashboard.
  if (normalized === 'researcher') return ROUTES.FORUM;
  return ROUTES.DASHBOARD;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRoleSelection, setPendingRoleSelection] = useState<{
    roles: UserRole[];
    selectedRole: UserRole | null;
    authResponse: AuthResponse;
  } | null>(null);

  const navigateToLandingForRole = useCallback(
    (role: string) => {
      navigate(landingRouteForRole(role));
    },
    [navigate]
  );

  /**
   * Persist the BE auth response into both the storage layer and the Zustand
   * store, then route based on the supplied role. Centralized here so the
   * single-role and multi-role branches in `login()` behave identically.
   */
  const persistAuthAndNavigate = useCallback(
    (response: AuthResponse, roleToUse: string) => {
      // Override `role` on the response so storage (which writes
      // `authResponse.role` as the persisted roleName) reflects the chosen
      // role rather than whatever the BE happened to put first.
      const responseWithChosenRole: AuthResponse = {
        ...response,
        role: roleToUse,
      };
      authService.setAuthData(responseWithChosenRole);
      authStore.login(
        {
          id: response.userId ?? 0,
          username: response.username,
          email: response.email,
          fullName: response.username,
          roleId: 0,
          roleName: roleToUse,
        },
        response.token
      );
      navigateToLandingForRole(roleToUse);
    },
    [authStore, navigateToLandingForRole]
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
        });
        setIsLoading(false);
        return;
      }

      // Single-role (or zero — fall back to BE's `role`) — proceed.
      const roleToUse = assignedRoles[0] ?? response.role;
      persistAuthAndNavigate(response, roleToUse);
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
      persistAuthAndNavigate(pendingRoleSelection.authResponse, role);
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

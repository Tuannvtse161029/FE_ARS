import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import authService from '../services/auth.service';
import { userService } from '../services/user.service';
import { ROUTES } from '../utils/constants';
import type { LoginRequest, AuthResponse, User, UserRole, EffectiveRole } from '../types/auth';
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
  /**
   * Agent 39 — authoritative role the user holds *right now*. Mirrors
   * `AuthResponse.effectiveRole` (BE-derived) or the persisted value after
   * page reload. `null` until the next successful login or while a
   * pre-migration blob is being rehydrated.
   */
  effectiveRole: EffectiveRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Agent 39 — derive the authoritative effective role for the just-logged-in
 * user. Trust the BE value (from `GET /api/user/{id}` or the login response)
 * when present; fall back to the derived value (unverified ⇒ 'Guest').
 * Never coerce an unknown string to 'Guest'.
 */
function resolveEffectiveRole(
  freshUser: User | null,
  response: AuthResponse,
  roleToUse: string,
): EffectiveRole {
  const fromFresh = freshUser?.effectiveRole;
  if (fromFresh) return fromFresh;
  const fromResponse = response.effectiveRole;
  if (fromResponse) return fromResponse;
  const isActive = freshUser?.isActive ?? response.isActive ?? false;
  return isActive ? (roleToUse as EffectiveRole) : 'Guest';
}

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
   *
   * Immediately after login, we call GET /api/user/{id} to fetch the BE's
   * authoritative user record. This overwrites ars_user with fresh data so
   * the user NEVER sees stale verificationStatus / isActive from a prior session
   * (e.g. an account approved by an Admin while the user was offline).
   */
  const persistAuthAndNavigate = useCallback(
    async (response: AuthResponse, roleToUse: string, rememberMe: boolean) => {
      // Select the storage bucket first — rememberBucket() inside storage.ts
      // reads getRememberMe() on every setToken/setUser call, so we MUST set
      // this BEFORE any setToken/setUser call below.
      storage.setRememberMe(rememberMe);
      storage.setToken(response.token);

      // Immediately fetch the authoritative user profile from the BE so ars_user
      // is written with the current state (verificationStatus, isActive, etc.).
      // Falls back to the login response fields if the GET fails (network glitch
      // or BE temporarily down — the stale snapshot is no worse than nothing).
      let freshUser: User | null = null;
      try {
        const userId = response.userId ?? 0;
        if (userId !== 0) {
          freshUser = await userService.getById(userId);
        }
      } catch {
        // silently skip — use the login response below as fallback
      }

      const userId = freshUser?.id ?? response.userId ?? 0;
      const userToPersist = freshUser ?? {
        id: userId,
        username: response.username,
        email: response.email,
        fullName: response.username,
        roleId: response.roleId ?? 0,
        roleName: roleToUse,
        isActive: response.isActive ?? false,
        verificationStatus: response.verificationStatus ?? 'Pending',
        accountTier: response.accountTier ?? 'Free',
      };
      storage.setUser(userToPersist);

      // We delegate to `landingRouteForRoleName` from utils/roleNormalizer so
      // the post-login redirect and the admin guard stay in sync. The
      // `isAdminOverride` flag covers the BE-bug sentinel where roleName
      // comes back as 'Researcher' but the dual-signal check above proves
      // the user is actually an Admin.
      const adminOverride = isAdminUser({
        roleName: roleToUse,
        roleId: response.roleId ?? 0,
      });

      authStore.login(
        {
          id: userId,
          username: freshUser?.username ?? response.username,
          email: freshUser?.email ?? response.email,
          fullName: freshUser?.fullName ?? response.username,
          roleId: freshUser?.roleId ?? response.roleId ?? 0,
          roleName: roleToUse,
          // Use the BE's authoritative isActive value; default to FALSE (lockout-safe).
          isActive: freshUser?.isActive ?? response.isActive ?? false,
          // Use the BE's authoritative verificationStatus value.
          verificationStatus: freshUser?.verificationStatus ?? response.verificationStatus ?? 'Pending',
          accountTier: freshUser?.accountTier ?? response.accountTier ?? 'Free',
          // Forward the BE-derived effective role so the verified-guard and
          // MainLayout can render the unverified-state UI without re-deriving
          // from `isActive`. Falls back to the derived value when the BE
          // doesn't surface the field (lockout-safe).
          effectiveRole: resolveEffectiveRole(freshUser, response, roleToUse),
        },
        response.token,
        resolveEffectiveRole(freshUser, response, roleToUse)
      );
      navigate(landingRouteForRoleName(roleToUse, { isAdminOverride: adminOverride }));
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
      await persistAuthAndNavigate(response, roleToUse, credentials.rememberMe ?? false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(errorMessage);
      authStore.setLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmRoleSelection = useCallback(
    async (role: UserRole) => {
      if (!pendingRoleSelection) return;
      // Persist using the stashed BE response, overriding `role` with the
      // user's choice. Token/email/username come from the original login.
      // Forward the original rememberMe choice so multi-role users get the
      // same storage-bucket behavior as single-role users.
      await persistAuthAndNavigate(
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

  /**
   * On every app boot (Zustand rehydrate completes while user is authenticated),
   * hit GET /api/user/{id} to overwrite the stale ars_user snapshot with the
   * BE's authoritative values. This is the fix for the verificationStatus bug:
   * a user approved by an Admin has their BE record updated, but the FE's cached
   * ars_user still showed the old "Pending" value from registration day.
   *
   * Runs only once per app session (no deps) and only when auth state is
   * rehydrated with a valid userId — the GET call will fail with 401 if the
   * token is invalid and we catch it silently.
   */
  useEffect(() => {
    const syncUserFromBE = async () => {
      const userId = authStore.user?.id;
      if (!authStore.isAuthenticated || !userId || userId === 0) return;

      try {
        const freshUser = await userService.getById(userId);

        // Overwrite ars_user with the BE's authoritative record.
        storage.setUser(freshUser);

        // Sync the Zustand store too so the in-memory view matches storage.
        // Agent 39 — also forward `effectiveRole` so the verified-guard and
        // MainLayout reflect the BE's authoritative role without reloading.
        authStore.updateUser({
          isActive: freshUser.isActive,
          verificationStatus: freshUser.verificationStatus,
          accountTier: freshUser.accountTier,
          effectiveRole:
            freshUser.effectiveRole ??
            (freshUser.isActive
              ? (freshUser.roleName as EffectiveRole)
              : 'Guest'),
        });
      } catch {
        // GET failed (401 = expired token, 404 = user deleted, 5xx = BE down).
        // Silently skip — the stale snapshot is no worse than nothing, and the
        // user can re-login to get a fresh token.
      }
    };

    // Wait for Zustand persist rehydration before reading authStore.user.
    // The `isLoading` flag flips to false once rehydration completes.
    if (!authStore.isLoading) {
      syncUserFromBE();
    }
  }, []); // intentionally empty — run once after first render when store is ready

  const value: AuthContextType = {
    user: authStore.user
      ? {
          token: authStore.token || '',
          userId: authStore.user.id,
          username: authStore.user.username,
          email: authStore.user.email,
          role: authStore.user.roleName,
          isActive: authStore.user.isActive ?? false,
          verificationStatus: authStore.user.verificationStatus ?? 'Pending',
          effectiveRole: authStore.user.effectiveRole,
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
    effectiveRole: authStore.effectiveRole,
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

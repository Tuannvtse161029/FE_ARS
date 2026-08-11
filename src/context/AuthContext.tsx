import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import authService from '../services/auth.service';
import storage from '../utils/storage';
import { ROUTES } from '../utils/constants';
import type { LoginRequest, AuthResponse } from '../types/auth';

interface AuthContextType {
  user: AuthResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session is restored automatically via Zustand persist (reads from ars-auth-storage).
  // The old useEffect that re-imported from ars_token/ars_user is removed
  // because it caused a double-write that triggered isLoading=true and blank screens.

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    authStore.setLoading(true);

    try {
      const response = await authService.login(credentials);
      authService.setAuthData(response);

      authStore.login(
        {
          id: 0,
          username: response.username,
          email: response.email,
          fullName: response.username,
          roleId: 0,
          roleName: response.role,
        },
        response.token
      );

      // DEBUG: Log what we're receiving
      console.log('[AuthContext] Login response:', {
        username: response.username,
        email: response.email,
        role: response.role,
        token: response.token?.substring(0, 20) + '...'
      });

      // Normalize the role string: trim, collapse spaces, lowercase for comparison.
      // - Admin → Dashboard
      // - Everyone else (Researcher, Reviewer, Lecturer, Graduate Student, etc.) → Forum
      const rawRole = response.role ?? '';
      const normalizedRole = rawRole.trim().replace(/\s+/g, ' ').toLowerCase();
      const isAdmin = normalizedRole === 'admin';
      const landingRoute = isAdmin ? ROUTES.DASHBOARD : ROUTES.FORUM;

      console.log('[AuthContext] Navigation decision:', {
        rawRole,
        normalizedRole,
        isAdmin,
        landingRoute
      });

      navigate(landingRoute);
      localStorage.setItem('ars_active_role', rawRole.trim());
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(errorMessage);
      authStore.setLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    authStore.logout();
    navigate(ROUTES.LOGIN);
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user: authStore.user
      ? {
          token: authStore.token || '',
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

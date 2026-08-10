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

      // Normalize: strip whitespace and match lowercase. Redirect Researcher → Forum, others → Dashboard.
      // Always redirect to Dashboard after login. Dashboard is the default landing
      // page and contains the role-aware Researcher Central view.
      navigate(ROUTES.DASHBOARD);
      localStorage.setItem('ars_active_role', response.role ?? '');
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

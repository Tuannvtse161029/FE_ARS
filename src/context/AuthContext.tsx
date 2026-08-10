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

  useEffect(() => {
    const storedUser = authService.getCurrentUser();
    if (storedUser && storage.getToken()) {
      authStore.login(
        {
          id: 0,
          username: storedUser.username,
          email: storedUser.email,
          fullName: storedUser.username,
          roleId: 0,
          roleName: storedUser.role,
        },
        storedUser.token
      );
    }
  }, []);

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

      navigate(ROUTES.DASHBOARD);
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

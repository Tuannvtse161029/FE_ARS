import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import { storage } from '../utils/storage';
import type {
  LoginRequest,
  RegisterRequest,
  RegisterPayload,
  AuthResponse,
} from '../types/auth';

export const authService = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    try {
      const response = await api.post<any>(API_ENDPOINTS.AUTH.LOGIN, {
        email: credentials.username,
        password: credentials.password,
      });

      const data = response.data;
      const token =
        data?.token ||
        data?.accessToken ||
        data?.jwt ||
        (typeof data === 'string' ? data : 'ars-session-token-' + Date.now());

      const email = data?.email || data?.user?.email || credentials.username;
      const username =
        data?.username ||
        data?.fullName ||
        data?.user?.fullName ||
        data?.user?.username ||
        credentials.username.split('@')[0];

      const role =
        data?.role ||
        data?.roleName ||
        data?.user?.role ||
        data?.user?.roleName ||
        'Researcher';

      return {
        token,
        username,
        email,
        role,
      };
    } catch (err: any) {
      console.warn('Backend login attempt failed:', err?.message || err);
      throw err;
    }
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    try {
      const response = await api.post<any>(API_ENDPOINTS.AUTH.REGISTER, {
        email: data.email,
        password: data.password,
        fullName: data.fullName,
      });

      const resData = response.data;
      const token = resData?.token || resData?.accessToken || 'ars-session-token-' + Date.now();
      const email = resData?.email || data.email;
      const username = resData?.fullName || data.fullName || data.email.split('@')[0];
      const role = resData?.role || 'Researcher';

      return {
        token,
        username,
        email,
        role,
      };
    } catch (err: any) {
      console.warn('Backend register attempt failed:', err?.message || err);
      throw err;
    }
  },

  registerUser: async (payload: RegisterPayload): Promise<AuthResponse> => {
    try {
      const response = await api.post<any>(API_ENDPOINTS.AUTH.REGISTER, payload);
      const resData = response.data;
      return {
        token: resData?.token || resData?.accessToken || 'ars-session-token-' + Date.now(),
        username: resData?.fullName || payload.fullName || payload.username,
        email: resData?.email || payload.email,
        role: resData?.role || payload.role || 'Researcher',
      };
    } catch (err: any) {
      console.warn('Backend registerUser attempt failed:', err?.message || err);
      throw err;
    }
  },

  logout: (): void => {
    storage.clearAuth();
    // Also clear the Zustand-persisted 'ars-auth-storage' key so that the
    // next page load (which rehydrates from localStorage) doesn't keep the
    // user "authenticated" and bounce PublicRoute → /dashboard.
    try {
      localStorage.removeItem('ars-auth-storage');
    } catch {
      /* ignore */
    }
  },

  getCurrentUser: (): AuthResponse | null => {
    const user = storage.getUser();
    const token = storage.getToken();
    if (user && token) {
      return {
        token,
        username: user.username,
        email: user.email,
        role: user.roleName,
      };
    }
    return null;
  },

  setAuthData: (authResponse: AuthResponse): void => {
    storage.setToken(authResponse.token);
    const user = {
      id: 0,
      username: authResponse.username,
      email: authResponse.email,
      fullName: authResponse.username,
      roleId: 0,
      roleName: authResponse.role,
    };
    storage.setUser(user);
  },

  isAuthenticated: (): boolean => {
    return !!storage.getToken();
  },

  // --- Reset Password flow (TEST MOCK — restore real BE calls before prod) ---
  forgotPassword: async (_email: string): Promise<void> => {
    // TODO (BE): Replace with real POST /api/auth/forgot-password
    await new Promise((r) => setTimeout(r, 800)); // simulate network
    console.log('[MOCK] forgotPassword called — replace with real BE call');
  },

  verifyOtp: async (_payload: { email: string; otp: string }): Promise<{ resetToken: string }> => {
    // TODO (BE): Replace with real POST /api/auth/verify-otp
    await new Promise((r) => setTimeout(r, 800)); // simulate network
    console.log('[MOCK] verifyOtp called — replace with real BE call');
    return { resetToken: 'mock-reset-token-123456' };
  },

  resetPassword: async (_payload: { token: string; newPassword: string }): Promise<void> => {
    // TODO (BE): Replace with real POST /api/auth/reset-password
    await new Promise((r) => setTimeout(r, 800)); // simulate network
    console.log('[MOCK] resetPassword called — replace with real BE call');
  },
};

export default authService;

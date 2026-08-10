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
    const response = await api.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, {
      email: credentials.username,
      password: credentials.password,
    });
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(API_ENDPOINTS.AUTH.REGISTER, {
      email: data.email,
      password: data.password,
      fullName: data.fullName,
    });
    return response.data;
  },

  registerUser: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(
      API_ENDPOINTS.AUTH.REGISTER,
      payload
    );
    return response.data;
  },

  logout: (): void => {
    storage.clearAuth();
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

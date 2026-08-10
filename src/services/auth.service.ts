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
};

export default authService;

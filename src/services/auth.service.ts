import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import { storage } from '../utils/storage';
import type {
  LoginRequest,
  RegisterRequest,
  RegisterPayload,
  AuthResponse,
  ForgotPasswordRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ResetPasswordRequest,
  VerifyEmailRequest,
  SendApprovalEmailRequest,
  UserRole,
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

      const userId =
        data?.userId ??
        data?.user?.userId ??
        data?.user?.id ??
        undefined;

      // Parse the assigned-role list from any of the common BE shapes.
      // Falls back to a single-element array containing `role` when the BE
      // does not yet expose the full list (older responses).
      const KNOWN_ROLES: UserRole[] = ['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student'];
      const isKnownRole = (r: unknown): r is UserRole =>
        typeof r === 'string' && KNOWN_ROLES.includes(r as UserRole);

      const rawRoles: unknown[] = Array.isArray(data?.roles)
        ? data.roles
        : Array.isArray(data?.userRoles)
        ? data.userRoles
        : Array.isArray(data?.user?.roles)
        ? data.user.roles
        : [];

      // Accept either an array of strings, or an array of { name } / { roleName } objects.
      const parsedRoles: UserRole[] = rawRoles
        .map((r) => {
          if (typeof r === 'string') return r;
          if (r && typeof r === 'object') {
            const obj = r as { name?: unknown; roleName?: unknown; role?: unknown };
            return (obj.name ?? obj.roleName ?? obj.role) as unknown;
          }
          return undefined;
        })
        .filter(isKnownRole);

      const roles: UserRole[] = parsedRoles.length > 0 ? parsedRoles : isKnownRole(role) ? [role] : ['Researcher'];

      return {
        token,
        username,
        email,
        role,
        userId,
        roles,
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
      // Legacy role-switch preference key — no longer used after the role
      // deprecation. Clean it up so users don't carry stale role data into
      // a new session.
      localStorage.removeItem('ars_active_role');
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

  // --- Reset password flow (real BE calls) ---
  forgotPassword: async (data: ForgotPasswordRequest): Promise<void> => {
    await api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, data);
  },

  verifyOtp: async (data: VerifyOtpRequest): Promise<VerifyOtpResponse> => {
    const response = await api.post<VerifyOtpResponse>(API_ENDPOINTS.AUTH.VERIFY_OTP, data);
    return response.data;
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<void> => {
    await api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data);
  },

  // --- Email verification / admin approval trigger ---
  verifyEmail: async (data: VerifyEmailRequest): Promise<void> => {
    await api.post(API_ENDPOINTS.AUTH.VERIFY_EMAIL, null, { params: { token: data.token } });
  },

  sendApprovalEmail: async (data: SendApprovalEmailRequest): Promise<void> => {
    await api.post(API_ENDPOINTS.AUTH.SEND_APPROVAL_EMAIL, null, { params: { email: data.email } });
  },
};

export default authService;

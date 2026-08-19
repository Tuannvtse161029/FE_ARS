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
  VerificationStatus,
  AccountTier,
  EffectiveRole,
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

      // BE convention: 1 = Researcher, 2 = Admin, 3 = Reviewer, 4 = Lecturer,
      // 5 = Graduate Student (see ROLE_IDS in src/types/auth.ts). Accept the
      // integer from any of the common BE shapes; fall back to 0 (the
      // "no role" sentinel) when the BE doesn't yet expose it.
      const roleIdRaw =
        data?.roleId ??
        data?.user?.roleId ??
        data?.user?.role?.id ??
        undefined;
      const roleId =
        typeof roleIdRaw === 'number' && Number.isFinite(roleIdRaw)
          ? roleIdRaw
          : 0;

      // `isActive` mirrors `dbo.Users.isActive`. New accounts start false
      // until an Admin approves the role request. Accept the flag from any
      // of the common BE shapes; coerce to a strict boolean; fall back to
      // FALSE (lockout-safe) when the field is absent — this is the critical
      // fix for Agent 26: Test 5 had isActive=true despite being unverified
      // because the BE sent the field as absent and this fallback granted access.
      const isActiveRaw =
        data?.isActive ??
        data?.user?.isActive ??
        data?.user?.IsActive ??
        undefined;
      const isActive =
        typeof isActiveRaw === 'boolean' ? isActiveRaw : false;

      // Parse the assigned-role list from any of the common BE shapes.
      // Falls back to a single-element array containing `role` when the BE
      // does not yet expose the full list (older responses).
      //
      // `Admin` is intentionally included in KNOWN_ROLES: a UserRole-typed
      // picker modal is the right surface for an admin who's been provisioned
      // by the DB. The self-registration UI blocks new Admin accounts; this
      // is only relevant to login parsing.
      const KNOWN_ROLES: UserRole[] = [
        'Researcher',
        'Reviewer',
        'Lecturer',
        'Graduate Student',
        'Admin',
      ];
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

      // `verificationStatus` mirrors `dbo.Users.verificationStatus`. Tracks where in
      // the registration lifecycle the user stands. Absent field → default to 'Pending'
      // (lockout-safe for pending registrations).
      const verificationStatusRaw = data?.verificationStatus ?? data?.user?.verificationStatus ?? undefined;
      const verificationStatus: VerificationStatus =
        verificationStatusRaw === 'Accepted' || verificationStatusRaw === 'Rejected'
          ? verificationStatusRaw
          : 'Pending';

      // `accountTier` mirrors `dbo.Users.accountTier`. Defaults to 'Free' when absent.
      const accountTierRaw = data?.accountTier ?? data?.user?.accountTier ?? undefined;
      const accountTier: AccountTier =
        accountTierRaw === 'Premium' || accountTierRaw === 'Enterprise'
          ? accountTierRaw
          : 'Free';

      // `effectiveRole` is the BE's authoritative "role the user holds right
      // now" — Differs from `role` only for users awaiting Admin approval of
      // their RoleRequest. Accept the field from any of the common BE shapes;
      // validate it against the EffectiveRole union; fall back to the derived
      // value (Pending/unverified → 'Guest') when the BE does not surface it.
      // Never coerce an unknown string to 'Guest' — only the documented BE
      // value (or the derived fallback) establishes a Guest session.
      // Dev-only warning lets us notice when the BE is missing the field so
      // we can escalate to BTR-AGENT39-01.
      const effectiveRoleRaw =
        data?.effectiveRole ??
        data?.user?.effectiveRole ??
        undefined;
      const KNOWN_EFFECTIVE_ROLES: EffectiveRole[] = [
        'Researcher',
        'Reviewer',
        'Lecturer',
        'Graduate Student',
        'Admin',
        'Guest',
      ];
      const isKnownEffectiveRole = (r: unknown): r is EffectiveRole =>
        typeof r === 'string' && (KNOWN_EFFECTIVE_ROLES as string[]).includes(r);
      let effectiveRole: EffectiveRole;
      if (isKnownEffectiveRole(effectiveRoleRaw)) {
        effectiveRole = effectiveRoleRaw;
      } else {
        if (typeof effectiveRoleRaw === 'string' && import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[auth] unknown effectiveRole string from BE:', effectiveRoleRaw);
        }
        if (effectiveRoleRaw === undefined && import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[auth] login response missing effectiveRole field — falling back to derived');
        }
        // Derived fallback: BE doesn't expose the field yet. Unverified users
        // are Guests; verified users keep their assigned role.
        effectiveRole = isActive ? (role as EffectiveRole) : 'Guest';
      }

      return {
        token,
        username,
        email,
        role,
        userId,
        roleId,
        roles,
        isActive,
        verificationStatus,
        accountTier,
        effectiveRole,
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
        // New registrations start pending until an Admin approves the role
        // request; echo it on the payload so BE-side validation can re-emit
        // it on the response and the FE doesn't have to guess.
        isActive: false,
      });

      const resData = response.data;
      const token = resData?.token || resData?.accessToken || 'ars-session-token-' + Date.now();
      const email = resData?.email || data.email;
      const username = resData?.fullName || data.fullName || data.email.split('@')[0];
      const role = resData?.role || 'Researcher';
      // New registrations are always pending; trust the BE echo when it
      // provides one, otherwise default to false (lockout-safe).
      const isActive =
        typeof resData?.isActive === 'boolean' ? resData.isActive : false;
      const verificationStatus: VerificationStatus =
        resData?.verificationStatus === 'Accepted' || resData?.verificationStatus === 'Rejected'
          ? resData.verificationStatus
          : 'Pending';
      const accountTier: AccountTier =
        resData?.accountTier === 'Premium' || resData?.accountTier === 'Enterprise'
          ? resData.accountTier
          : 'Free';
      // New registrations are always 'Guest' effective role until an Admin
      // approves the role request. Trust the BE echo when present; otherwise
      // derive from isActive (lockout-safe: undefined ⇒ 'Guest').
      const effectiveRoleRaw = resData?.effectiveRole ?? resData?.user?.effectiveRole ?? undefined;
      const effectiveRole: EffectiveRole =
        typeof effectiveRoleRaw === 'string' &&
        [
          'Researcher',
          'Reviewer',
          'Lecturer',
          'Graduate Student',
          'Admin',
          'Guest',
        ].includes(effectiveRoleRaw)
          ? (effectiveRoleRaw as EffectiveRole)
          : isActive
            ? (role as EffectiveRole)
            : 'Guest';

      return {
        token,
        username,
        email,
        role,
        isActive,
        verificationStatus,
        accountTier,
        effectiveRole,
      };
    } catch (err: any) {
      console.warn('Backend register attempt failed:', err?.message || err);
      throw err;
    }
  },

  registerUser: async (payload: RegisterPayload): Promise<AuthResponse> => {
    try {
      const response = await api.post<any>(API_ENDPOINTS.AUTH.REGISTER, {
        ...payload,
        // Same as register(): new accounts start unverified.
        isActive: false,
      });
      const resData = response.data;
      const isActive =
        typeof resData?.isActive === 'boolean' ? resData.isActive : false;
      const verificationStatus: VerificationStatus =
        resData?.verificationStatus === 'Accepted' || resData?.verificationStatus === 'Rejected'
          ? resData.verificationStatus
          : 'Pending';
      const accountTier: AccountTier =
        resData?.accountTier === 'Premium' || resData?.accountTier === 'Enterprise'
          ? resData.accountTier
          : 'Free';
      const effectiveRoleRaw = resData?.effectiveRole ?? resData?.user?.effectiveRole ?? undefined;
      const effectiveRole: EffectiveRole =
        typeof effectiveRoleRaw === 'string' &&
        [
          'Researcher',
          'Reviewer',
          'Lecturer',
          'Graduate Student',
          'Admin',
          'Guest',
        ].includes(effectiveRoleRaw)
          ? (effectiveRoleRaw as EffectiveRole)
          : isActive
            ? ((resData?.role || payload.role || 'Researcher') as EffectiveRole)
            : 'Guest';
      return {
        token: resData?.token || resData?.accessToken || 'ars-session-token-' + Date.now(),
        username: resData?.fullName || payload.fullName || payload.username,
        email: resData?.email || payload.email,
        role: resData?.role || payload.role || 'Researcher',
        isActive,
        verificationStatus,
        accountTier,
        effectiveRole,
      };
    } catch (err: any) {
      console.warn('Backend registerUser attempt failed:', err?.message || err);
      throw err;
    }
  },

  logout: (): void => {
    storage.clearAuth();
    // Clear the Zustand auth store. Since authSlice was updated to use a
    // sessionStorage-backed adapter, the key lives in sessionStorage — but
    // clear it from localStorage too so a stale entry can't survive a future
    // revert of that adapter change.
    try {
      sessionStorage.removeItem('ars-auth-storage');
      localStorage.removeItem('ars-auth-storage');
      // Legacy role-switch preference key — no longer used after the role
      // deprecation. Clean it up so users don't carry stale role data into
      // a new session.
      localStorage.removeItem('ars_active_role');
      sessionStorage.removeItem('ars_active_role');
    } catch {
      /* ignore */
    }
  },

  getCurrentUser: (): AuthResponse | null => {
    const user = storage.getUser();
    const token = storage.getToken();
    if (user && token) {
      // Read ALL fields from persisted user — not just token/username/role.
      // Missing verificationStatus/accountTier defaults mirror the live path:
      // For `effectiveRole`, fall back to the derived value (unverified ⇒
      // 'Guest') when the persisted blob pre-dates the migration. Old blobs
      // hydrate cleanly because the field is optional everywhere.
      const isActive = user.isActive ?? false;
      return {
        token,
        username: user.username,
        email: user.email,
        role: user.roleName,
        isActive,
        verificationStatus: user.verificationStatus ?? 'Pending',
        accountTier: user.accountTier ?? 'Free',
        effectiveRole:
          user.effectiveRole ??
          (isActive && user.roleName
            ? (user.roleName as EffectiveRole)
            : 'Guest'),
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
      // Persist the BE's authoritative roleId so subsequent loads (which
      // hydrate from storage before BE is reachable) can still detect admin.
      // Falls back to 0 when the BE didn't supply one.
      roleId: authResponse.roleId ?? 0,
      roleName: authResponse.role,
      // Default to false (lockout-safe) when the BE didn't echo this —
      // this is the critical fix for the Test 5 vulnerability.
      isActive: authResponse.isActive ?? false,
      // Mirror verificationStatus from BE; default to 'Pending' (lockout-safe).
      verificationStatus: authResponse.verificationStatus ?? 'Pending',
      // Mirror accountTier from BE; default to 'Free'.
      accountTier: authResponse.accountTier ?? 'Free',
      // Mirror effectiveRole from BE; default to derived (unverified ⇒ 'Guest').
      // This is what MainLayout / Forum / verified-guard read when deciding
      // whether to render the pending-state banner.
      effectiveRole:
        authResponse.effectiveRole ??
        (authResponse.isActive
          ? (authResponse.role as EffectiveRole)
          : 'Guest'),
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

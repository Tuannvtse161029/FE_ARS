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
  User,
} from '../types/auth';

/**
 * Documented ARS auth-related localStorage / sessionStorage keys.
 *
 * Every ARS auth artefact that must be cleared during a logout / session
 * reset is listed here so the centralized cleanup routine can target them
 * by name. Domain data keys (e.g. `ars_wallet`, `ars_reviewer_balance`) are
 * intentionally NOT included — they belong to other modules and must
 * survive a session reset so the user does not lose unrelated state.
 *
 * NOTE: keep this list in sync with `authSlice.ts` and `storage.ts`. Any
 * new persisted auth field MUST be added here.
 */
const ARS_AUTH_STORAGE_KEYS = [
  'ars_token',
  'ars_user',
  'ars_remember',
  'ars-active-role',
  'ars_active_role',
  // Agent 52 — Google onboarding session. (No longer used by the
  // Agent 52 surface as of the follow-up correction — the JWT is
  // carried by the standard `ars_token` key; the profile is read
  // from the auth store. We keep the entry here as a defensive
  // cleanup so a previous build's half-written session doesn't
  // survive the logout boundary.)
  'ars_google_onboarding_session',
  // Agent 30 — first-time Google onboarding "submitted" sentinel.
  // Set by CompleteGoogleRegistration after a successful POST, used
  // to make a page refresh idempotent (a re-render of the page
  // should not re-submit the role request). Cleared on logout so a
  // *new* first-time user can complete onboarding from scratch.
  'ars_google_onboarding_submitted',
] as const;

/**
 * Agent 53 — central document of the session-scoped Zustand persist key.
 * `authSlice.ts` writes the auth store under this name into
 * sessionStorage; the legacy dual-bucket layout also writes it into
 * localStorage, so the cleanup routine must clear both buckets.
 */
const ARS_AUTH_ZUSTAND_KEY = 'ars-auth-storage';

/**
 * Removed in this revision: the Agent 30 `ARS_GOOGLE_CREDENTIAL_KEY`
 * sessionStorage cache and its `setGoogleCredential` / `getGoogleCredential`
 * helpers. The onboarding completion endpoint authenticates via the ARS
 * JWT only — neither the credential-flow (Login → GIS) nor the legacy
 * code-redirect-flow (`/auth/google/callback`) has the upstream Google
 * ID token available for forwarding. The BE ticket
 * (`BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md`) explicitly forbids
 * echoing identity-provider tokens in requests.
 */

/**
 * Defensive Google Identity Services auto-select toggle. Called only when
 * the GIS library is actually present on `window.google.accounts.id`. We
 * intentionally do NOT call `google.accounts.id.revoke()` — that would
 * terminate the user's Google account-level consent, which is a privacy
 * escalation outside the scope of an ARS session logout.
 *
 * The auto-select toggle is read by the next Google Sign-In prompt and
 * stops the browser from immediately re-authenticating a user who just
 * signed out of ARS.
 */
function disableGoogleAutoSelectIfAvailable(): void {
  if (typeof window === 'undefined') return;
  const google = (window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } }).google;
  const disable = google?.accounts?.id?.disableAutoSelect;
  if (typeof disable === 'function') {
    try {
      disable();
    } catch {
      /* defensive — GIS may be in a non-initialized state during logout */
    }
  }
}

/**
 * Agent 53 — centralized ARS session cleanup.
 *
 * Performs a complete, null-safe logout of the ARS session:
 *
 *   1. Remove every documented ARS auth-related key from BOTH
 *      localStorage and sessionStorage (token, user blob, remember flag,
 *      Zustand auth store, legacy role key, Google onboarding draft).
 *   2. Strip the Axios `Authorization` header from the shared instance so
 *      the next request is not sent with a stale bearer token.
 *   3. Defensive Google Identity Services auto-select toggle so the
 *      browser does not immediately re-prompt the just-signed-out user.
 *
 * The backend does not expose a documented revocation contract for logout,
 * so this routine intentionally performs local cleanup only. Calling a
 * protected logout endpoint after removing the token would recursively
 * trigger the Axios 401 interceptor.
 *
 * No call to `localStorage.clear()` — that would wipe unrelated domain
 * data (wallet, reviewer balance, etc.) and break cross-session state.
 */
export async function clearAuthSession(): Promise<void> {
  // ── Synchronous cleanup (must run before the await) ───────────────────────
  try {
    ARS_AUTH_STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore quota / privacy-mode errors */
      }
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    });

    // Zustand auth store under both buckets (sessionStorageAdapter writes
    // sessionStorage; the legacy dual-bucket adapter also wrote
    // localStorage — strip both for safety).
    try {
      localStorage.removeItem(ARS_AUTH_ZUSTAND_KEY);
      sessionStorage.removeItem(ARS_AUTH_ZUSTAND_KEY);
    } catch {
      /* ignore */
    }

    // Strip the Axios authorization header so no follow-up call sends a
    // stale bearer token. We mutate the shared default headers in place
    // because the existing axios instance is a module-level singleton.
    try {
      if (api?.defaults?.headers?.common) {
        delete (api.defaults.headers.common as Record<string, unknown>).Authorization;
      }
      if (api?.defaults?.headers) {
        if ('Authorization' in api.defaults.headers) {
          delete (api.defaults.headers as Record<string, unknown>).Authorization;
        }
      }
    } catch {
      /* defensive — axios may be mocked in tests */
    }

    // Defensive GIS auto-select disable (no-op when GIS is absent).
    disableGoogleAutoSelectIfAvailable();
  } catch {
    /* swallow — the synchronous cleanup is best-effort */
  }

  // ── Local cleanup only ───────────────────────────────────────────────────
  // The BE has no documented logout/revocation contract. More importantly,
  // calling a protected logout endpoint after clearing the token would make
  // its 401 response re-enter the Axios 401 interceptor indefinitely.
  return;
}

export const authService = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    try {
      // Chuẩn hoá role gửi lên BE:
      // Nếu user chọn Auto-detect hoặc không chọn hoặc role là Guest -> gửi null
      // Nếu user chọn role cụ thể ('Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin') -> gửi role string
      const roleToSend =
        credentials.selectedRole &&
        credentials.selectedRole.trim() &&
        credentials.selectedRole.trim().toLowerCase() !== 'guest' &&
        credentials.selectedRole.trim().toLowerCase() !== 'null'
          ? credentials.selectedRole.trim()
          : null;

      const response = await api.post<any>(API_ENDPOINTS.AUTH.LOGIN, {
        email: credentials.username,
        password: credentials.password,
        role: roleToSend,
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
        (data?.verificationStatus === 'Pending' || data?.isActive === false ? 'Guest' : 'Researcher');

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
    // Logout is intentionally local-only. The shared Axios 401 interceptor
    // handles expired sessions; sending another protected request here would
    // recursively trigger that interceptor when the token is already gone.
    void clearAuthSession();
    storage.clearAuth();
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
        // Agent 30 (regression) — preserve the BE-supplied
        // `verificationStatus` as `null` when the BE omitted it. The
        // prior `'Pending'` default coerced a brand-new account
        // into a false "Admin review in flight" state.
        verificationStatus: user.verificationStatus ?? null,
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
    const user: User = {
      id: authResponse.userId ?? 0,
      username: authResponse.username,
      email: authResponse.email,
      fullName: authResponse.username,
      roleId: authResponse.roleId ?? null,
      roleName: authResponse.role,
      roles: authResponse.roles,
      isActive: authResponse.isActive ?? false,
      verificationStatus: authResponse.verificationStatus ?? null,
      accountTier: authResponse.accountTier ?? 'Free',
      effectiveRole:
        authResponse.effectiveRole ??
        (authResponse.isNewUser || authResponse.requiresOnboarding
          ? undefined
          : authResponse.isActive && authResponse.role
            ? (authResponse.role as EffectiveRole)
            : 'Guest'),
      isNewUser: authResponse.isNewUser,
      requiresOnboarding: authResponse.requiresOnboarding,
    };
    storage.setUser(user);
  },

  isAuthenticated: (): boolean => {
    return !!storage.getToken();
  },

  // --- Reset password flow (real BE calls) ---
  // Luồng 1: POST /api/Auth/forgot-password { email: string }
  forgotPassword: async (data: ForgotPasswordRequest): Promise<{ message?: string }> => {
    const response = await api.post<{ message?: string }>(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      email: data.email.trim(),
    });
    return response.data;
  },

  // Verify OTP: POST /api/Auth/verify-otp { email: string, otpCode: string }
  verifyOtp: async (data: VerifyOtpRequest): Promise<VerifyOtpResponse> => {
    const response = await api.post<VerifyOtpResponse>(API_ENDPOINTS.AUTH.VERIFY_OTP, {
      email: data.email.trim(),
      otpCode: data.otpCode.trim(),
    });
    return response.data;
  },

  // Resend OTP: POST /api/Auth/resend-otp?email=...
  resendOtp: async (email: string): Promise<any> => {
    try {
      const response = await api.post(API_ENDPOINTS.AUTH.RESEND_OTP, null, {
        params: { email: email.trim() },
      });
      return response.data;
    } catch {
      const response = await api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        email: email.trim(),
      });
      return response.data;
    }
  },

  // Luồng 2: POST /api/Auth/reset-password { email, otpCode, newPassword, confirmPassword }
  resetPassword: async (data: ResetPasswordRequest): Promise<{ message?: string }> => {
    const response = await api.post<{ message?: string }>(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
      email: data.email.trim(),
      otpCode: data.otpCode.trim(),
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword || data.newPassword,
    });
    return response.data;
  },

  // --- Email verification / OTP trigger ---
  verifyEmail: async (data: VerifyEmailRequest): Promise<void> => {
    await api.post(API_ENDPOINTS.AUTH.VERIFY_EMAIL, null, { params: { token: data.token } });
  },

  sendApprovalEmail: async (data: SendApprovalEmailRequest): Promise<void> => {
    await api.post(API_ENDPOINTS.AUTH.SEND_APPROVAL_EMAIL, null, { params: { email: data.email } });
  },

  sendRegistrationOtp: async (email: string): Promise<void> => {
    try {
      await api.post(API_ENDPOINTS.AUTH.SEND_APPROVAL_EMAIL, null, { params: { email } });
    } catch (err) {
      console.warn('[authService] sendRegistrationOtp notification:', err);
    }
  },

  verifyRegistrationOtp: async (email: string, otpCode: string): Promise<any> => {
    try {
      const response = await api.post(API_ENDPOINTS.AUTH.VERIFY_OTP, {
        email: email.trim(),
        otpCode: otpCode.trim(),
      });
      return response.data;
    } catch (err: any) {
      // If verify-otp fails, try fallback to verify-email query param
      try {
        const fallbackRes = await api.post(API_ENDPOINTS.AUTH.VERIFY_EMAIL, null, {
          params: { token: otpCode.trim() },
        });
        return fallbackRes.data;
      } catch {
        throw err;
      }
    }
  },

  // --- Dynamic Roles fetching from GET /api/Role ---
  getRoles: async (): Promise<Array<{ id?: number; name?: string; roleName?: string; description?: string }>> => {
    try {
      const response = await api.get(API_ENDPOINTS.ROLE.GET_ALL);
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.data)) {
        return data.data;
      }
      if (data && Array.isArray(data.roles)) {
        return data.roles;
      }
      return [];
    } catch (err) {
      console.warn('[authService] Failed to fetch roles from /api/Role:', err);
      return [];
    }
  },
};

export default authService;

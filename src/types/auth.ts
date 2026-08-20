// Verification and account state machine.
// All new registrations go through: Registered → Email Verified → Admin Reviewed → Active.
// The BE stores these as database fields; the FE mirrors them for route-gating.
export type VerificationStatus = 'Pending' | 'Accepted' | 'Rejected';
export type AccountTier = 'Free' | 'Premium' | 'Enterprise';

export interface LoginRequest {
  username: string;
  password: string;
  // When true, persist token/user to localStorage (survives browser restart).
  // When false/undefined, persist to sessionStorage (cleared when tab closes).
  // The AuthContext flips the storage bucket via storage.setRememberMe() BEFORE
  // writing the token so storage.setToken/setUser route to the correct
  // backing store without changing their signatures.
  rememberMe?: boolean;
}

// BusinessRole — the persisted role set (renamed from UserRole for clarity
// when paired with the effective role) used by the BE's /api/UserRole
// subsystem. The string literal 'Graduate Student' (with a space) is the
// existing convention; do not normalise to 'GraduateStudent'.
//
// UserRole is kept as the public alias to preserve every existing call site
// (`src/pages/Register/Register.tsx`, `src/pages/Login/components/RoleSelectionModal.tsx`,
// the `ROLE_IDS` keys, the role guard allow lists, the admin `currentRoles`
// mock, etc.). We do NOT add 'Guest' here — Guest is an effective-time
// variant, not a persisted role.
export type BusinessRole =
  | 'Researcher'
  | 'Admin'
  | 'Reviewer'
  | 'Lecturer'
  | 'Graduate Student';
export type UserRole = BusinessRole;
export const ROLE_IDS = {
  Researcher: 1,
  Admin: 2,
  Reviewer: 3,
  Lecturer: 4,
  GraduateStudent: 5,
} as const;
export type RoleIdValue = (typeof ROLE_IDS)[keyof typeof ROLE_IDS];

// EffectiveRole — the role the user holds *right now* during authentication.
// Mirrors what the BE returns from the login response (per
// BTR-AGENT39-01) and what the role-request state machine implies. The
// 'Guest' variant is the effective-time state for users awaiting Admin
// approval of their RoleRequest — see
// docs/local-only/be-requests/guest-role-request.md. It is NOT a persisted
// role, does NOT have a numeric RoleId, and does NOT appear in
// `GET /api/Role`.
export type EffectiveRole = BusinessRole | 'Guest';

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  pdfUrl: string;
  // The BE seeds new accounts as pending (isActive: false) until an Admin
  // approves the role request. The FE sends this so BE-side validation can
  // echo it back unchanged; the FE also falls back to `false` when BE omits
  // the field on the response.
  isActive?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  /**
   * BE-derived business-role name. Nullable to accommodate first-time
   * Google accounts where the BE has not yet assigned a role. The
   * admin-guard reads `role ?? null` so a `null` here is a safe
   * lockout sentinel. See BTR-AGENT52-04.
   */
  role: string | null;
  userId?: number;
  // BE's authoritative role identifier (1-5, see ROLE_IDS). The FE accepts
  // either `roleId` OR `roleName` as the role signal until the BE's
  // zero/one-based mapping bug is fixed; see useAdminGuard.
  roleId?: number;
  // All roles assigned to this user. When more than one role is returned,
  // the FE prompts the user to pick one before navigating to the dashboard.
  // When omitted (single-role user or older BE), the FE falls back to [role].
  roles?: UserRole[];
  // Mirrors `dbo.Users.isActive`. New registrations start false (unverified)
  // and flip to true when an Admin approves the role request. Unverified users
  // get read-only access to /forum only. The BE is the authoritative source;
  // the FE defaults to false (lockout-safe) when the field is absent.
  isActive?: boolean;
  // Mirrors `dbo.Users.verificationStatus`. Tracks where in the registration
  // lifecycle the user stands. Required for the complete state machine:
  //   Registered:    isEmailVerified=false, verificationStatus='Pending', isActive=false
  //   Email Verified: isEmailVerified=true,  verificationStatus='Pending', isActive=false
  //   Admin Accepted: isEmailVerified=true,  verificationStatus='Accepted', isActive=true
  //   Admin Rejected: isEmailVerified=true,  verificationStatus='Rejected', isActive=false
  verificationStatus?: VerificationStatus;
  // Mirrors `dbo.Users.accountTier`. Must default to 'Free' on registration.
  accountTier?: AccountTier;
  /**
   * Authoritative role the user holds *right now*. Differs from `role` only
   * for users awaiting Admin approval of their RoleRequest — in that case
   * the BE returns `effectiveRole: 'Guest'` while `role` remains the
   * requested future role. The FE must trust this field over the derived
   * `!isActive && !isAdmin` heuristic when present (BTR-AGENT39-01).
   *
   * When the BE does not surface this field, the FE falls back to the
   * derived value (unverified ⇒ 'Guest'). Never coerce an unknown string
   * to 'Guest' — only the documented BE value (or the derived fallback)
   * establishes a Guest session.
   */
  effectiveRole?: EffectiveRole;
}

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  orcidId?: string;
  /**
   * BE-derived business-role identifier (see ROLE_IDS). The FE accepts
   * `null` here when the BE has not yet assigned a role — e.g. on a
   * freshly-created Google account that is awaiting onboarding. The
   * verified-guard and admin guard already treat `null` as "no role
   * assigned" (lockout-safe). See BTR-AGENT52-04.
   */
  roleId: number | null;
  /**
   * BE-derived business-role name. `null` when the BE has not yet
   * assigned a role. The role-name-based admin guard checks
   * `roleName ?? null` against the known list, so `null` is a safe
   * lockout sentinel.
   */
  roleName: string | null;
  // Mirrors `dbo.Users.isActive`. False until an Admin approves the role
  // request that was filed at registration time. Defaults to false (lockout-safe)
  // so a BE that hasn't shipped this field doesn't grant unregistered users access.
  isActive: boolean;
  // Mirrors `dbo.Users.isEmailVerified`. True after the user clicks the
  // verification link sent at registration. Required for the verified-guard
  // to grant access to role workspaces (see BTR-AGENT39). Defaults to
  // false (lockout-safe) when the BE omits the field.
  isEmailVerified?: boolean;
  // Mirrors `dbo.Users.proofDocumentUrl`. Public URL of the registration
  // proof PDF (Firebase Storage). Admin verification pages render this in
  // the existing PDF viewer; null when no proof was supplied.
  proofDocumentUrl?: string | null;
  // Mirrors `dbo.Users.verificationStatus`. Required for complete state machine
  // checking — see AuthResponse.verificationStatus for the full lifecycle.
  verificationStatus?: VerificationStatus;
  // Mirrors `dbo.Users.accountTier`. Defaults to 'Free' per BE defaults.
  accountTier?: AccountTier;
  createdAt?: string;
  updatedAt?: string;
  /** ISO timestamp; present when an admin has suspended the account. Null when unsuspended. */
  suspendedUntil?: string | null;
  /**
   * Authoritative role the user holds *right now* — carried through from
   * the BE's `GET /api/user/{id}` response when present. The FE mirrors it
   * here so MainLayout / Forum / verified-guard can render the unverified
   * state without re-deriving from `isActive && verificationStatus`. See
   * `EffectiveRole` and BTR-AGENT39-01.
   */
  effectiveRole?: EffectiveRole;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Effective role resolved at login time. Mirrors `AuthResponse.effectiveRole`
   * and the BE-derived login payload. `null` until the first successful login
   * or while a pre-migration persisted blob is being rehydrated (the
   * verified-guard derives Guest from `!isActive && !isAdmin` in that
   * window — see `isGuestUser` in `src/hooks/usePermissions.ts`).
   */
  effectiveRole: EffectiveRole | null;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  resetToken: string;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface SendApprovalEmailRequest {
  email: string;
}

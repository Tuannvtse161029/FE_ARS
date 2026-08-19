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

// UserRole - only for self-registration (excludes Admin which is DB-only)
export type UserRole = 'Researcher' | 'Reviewer' | 'Lecturer' | 'Graduate Student' | 'Admin';

// BE convention per docs/local-only/erd-schema-reference.md:
// 1 = Researcher, 2 = Admin, 3 = Reviewer, 4 = Lecturer, 5 = Graduate Student.
// Until the BE AuthController fixes the zero-based/one-based mismatch, the FE
// has to accept either `roleId` OR `roleName` as the source of truth. This is
// documented in docs/local-only/admin-suite-be-gap-report.md and intentionally
// re-validated by src/tests/utils/role.normalizer.test.ts.
export const ROLE_IDS = {
  Researcher: 1,
  Admin: 2,
  Reviewer: 3,
  Lecturer: 4,
  GraduateStudent: 5,
} as const;
export type RoleIdValue = (typeof ROLE_IDS)[keyof typeof ROLE_IDS];

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
  role: string;
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
}

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  orcidId?: string;
  roleId: number;
  roleName: string;
  // Mirrors `dbo.Users.isActive`. False until an Admin approves the role
  // request that was filed at registration time. Defaults to false (lockout-safe)
  // so a BE that hasn't shipped this field doesn't grant unregistered users access.
  isActive: boolean;
  // Mirrors `dbo.Users.verificationStatus`. Required for complete state machine
  // checking — see AuthResponse.verificationStatus for the full lifecycle.
  verificationStatus?: VerificationStatus;
  // Mirrors `dbo.Users.accountTier`. Defaults to 'Free' per BE defaults.
  accountTier?: AccountTier;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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

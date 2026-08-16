export interface LoginRequest {
  username: string;
  password: string;
}

// UserRole - only for self-registration (excludes Admin which is DB-only)
export type UserRole = 'Researcher' | 'Reviewer' | 'Lecturer' | 'Graduate Student';

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  pdfUrl: string;
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
  // All roles assigned to this user. When more than one role is returned,
  // the FE prompts the user to pick one before navigating to the dashboard.
  // When omitted (single-role user or older BE), the FE falls back to [role].
  roles?: UserRole[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  orcidId?: string;
  roleId: number;
  roleName: string;
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

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
  orcidId?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  orcidId?: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  role: string;
  userId?: number;
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

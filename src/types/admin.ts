// Admin surface types.
// Mirrors the Figma Admin Suite (5 screens) and the gap report at
// docs/local-only/admin-suite-be-gap-report.md. Until BE ships the new endpoints,
// these shapes are populated by `adminService` against live API responses.

// ── Role requests (Figma screen 2) ─────────────────────────────────────────
export type RoleRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED';
export type RoleRequestType = 'INITIAL_REGISTRATION' | 'ADDITIONAL_ROLE';

export interface RoleRequest {
  id: number;
  userId: number;
  userName: string;
  email: string;
  phone?: string;
  affiliation: string;
  department: string;
  /** Roles already assigned when the request was submitted. */
  currentRoles?: string[];
  /** Roles requested by this specific verification request. */
  requestedAdditionalRoles?: string[];
  /** Must be supplied explicitly by BE; FE never derives this from array order. */
  requestType?: RoleRequestType;
  /** Legacy contract field retained only for compatibility; never used to infer role intent. */
  requestedRoles?: string[];
  proofDocumentUrl: string;
  orcidId?: string | null;
  isOrcidVerified?: boolean;
  orcidVerifiedAt?: string | null;
  submissionDate: string;
  status: RoleRequestStatus;
  notes?: string;
}

export interface RoleRequestDecision {
  status: Exclude<RoleRequestStatus, 'PENDING'>;
  notes?: string;
}

// ── Accounts (Figma screen 3) ──────────────────────────────────────────────
// TRIAL — the BE surfaces this state for first-time Researcher / Lecturer
// accounts whose 7-day trial is still running. The FE renders a status pill
// (and the row's `trialExpiryAt` shows the deadline) so admins can monitor
// upcoming trial expirations alongside the existing ACTIVE / SUSPENDED /
// EXPIRED set.
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'TRIAL';
export type AccountPlan = 'FREE_TIER' | 'PREMIUM';
export type AccountRoleName =
  | 'LECTURER'
  | 'RESEARCHER'
  | 'GRADUATE_STUDENT'
  | 'REVIEWER';

export interface AccountItem {
  id: number;
  name: string;
  email: string;
  roles: AccountRoleName[];
  plan: AccountPlan;
  joinedDate: string;
  status: AccountStatus;
  // Optional ISO timestamp. When present and `status` is SUSPENDED, the
  // AccountsManagement page surfaces a "Suspended until ..." pill so the admin
  // can see when the lock lifts. Set by the violation-resolution modal's
  // 14-day-suspend action; null/undefined means "indefinite / manually revoked".
  suspendedUntil?: string | null;
  /**
   * Optional ISO timestamp. When present and `status` is `TRIAL`, the
   * AccountsManagement page surfaces a "Trial until ..." pill so the
   * admin can see when the user's 7-day Researcher / Lecturer trial
   * ends. The BE assigns this only to first-time role-holders; absent
   * for non-trial accounts.
   */
  trialExpiryAt?: string | null;
  // Mirrors `dbo.Users.isActive`. Defaults to true for accounts already
  // provisioned in the seed data (they were created by an Admin, not via
  // self-registration). Flipped to true by `decideRoleRequest` when a
  // pending registration's role request is APPROVED. Existing UI doesn't
  // render this flag — it mirrors the BE-side
  // isActive flip without breaking the admin AccountItem shape.
  isActive?: boolean;
}

export interface AccountsQuery {
  search?: string;
  role?: AccountRoleName | 'ALL';
  plan?: AccountPlan | 'ALL';
  status?: AccountStatus | 'ALL';
}

// ── Analytics (Figma screen 1) ────────────────────────────────────────────
export type AnalyticsRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type AnalyticsMetric = 'user_registrations' | 'revenue';

export interface AnalyticsSummary {
  totalMembers: number;
  totalPapers: number;
}

export interface AnalyticsTimeSeriesPoint {
  date: string;
  value: number;
}

export interface AnalyticsTimeSeries {
  range: AnalyticsRange;
  metric: AnalyticsMetric;
  points: AnalyticsTimeSeriesPoint[];
}

// Admin surface types.
// Mirrors the Figma Admin Suite (5 screens) and the gap report at
// docs/local-only/admin-suite-be-gap-report.md. Until BE ships the new endpoints,
// these shapes are populated by `adminService` against mock data via a
// USE_MOCK_DATA flag.

// ── Role requests (Figma screen 2) ─────────────────────────────────────────
export type RoleRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface RoleRequest {
  id: number;
  userId: number;
  userName: string;
  email: string;
  phone?: string;
  affiliation: string;
  department: string;
  // Figma screen 2 shows single-role labels, but the BE may return multi-role
  // arrays (e.g. ['RESEARCHER', 'REVIEWER']). Single-role requests arrive as
  // 1-element arrays. Excludes GRADUATE_STUDENT for non-initial requests.
  requestedRoles: string[];
  proofDocumentUrl: string;
  submissionDate: string;
  status: RoleRequestStatus;
  notes?: string;
}

export interface RoleRequestDecision {
  status: Exclude<RoleRequestStatus, 'PENDING'>;
  notes?: string;
}

// ── Accounts (Figma screen 3) ──────────────────────────────────────────────
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
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
  // Mirrors `dbo.Users.isActive`. Defaults to true for accounts already
  // provisioned in the seed data (they were created by an Admin, not via
  // self-registration). Flipped to true by `decideRoleRequest` when a
  // pending registration's role request is APPROVED. Existing UI doesn't
  // render this flag — it exists so the mock can simulate the BE-side
  // isActive flip without breaking the admin AccountItem shape.
  isActive?: boolean;
}

export interface AccountsQuery {
  search?: string;
  role?: AccountRoleName | 'ALL';
  plan?: AccountPlan | 'ALL';
  status?: AccountStatus | 'ALL';
}

// ── Withdrawals (Figma screens 4–5) ────────────────────────────────────────
// 3-state manual payout flow per the Figma:
//   PENDING → ACCEPTED_PROCESSING → COMPLETED, with DENIED as a terminal.
export type WithdrawalStatus =
  | 'PENDING'
  | 'ACCEPTED_PROCESSING'
  | 'COMPLETED'
  | 'DENIED';

export interface WithdrawalRequestItem {
  // Mirrors the existing WithdrawalRequest.id (normalized to `id`).
  txId: number;
  userId: number;
  reviewerName: string;
  amountVnd: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  requestDate: string;
  status: WithdrawalStatus;
  proofReceiptUrl: string | null;
  rejectionReason?: string;
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

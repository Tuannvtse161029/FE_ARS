// Admin Auxiliary types.
// Mirrors Figma screens 6-9 (image_d6b406.jpg through image_d6b09c.jpg) and
// the backend API schemas. Runtime services use live endpoint responses and
// surface an explicit unavailable state when a contract is missing.

// ── Violation reports (Figma screens 7 + 8) ─────────────────────────────────
export type ViolationReportType = 'FORUM_COMMENT' | 'RESEARCH_PAPER';
export type ViolationReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export type ViolationResolutionAction =
  | 'DISMISS'
  | 'DELETE_CONTENT_WARN'
  | 'DELETE_CONTENT_SUSPEND_14D';

export interface ViolationResolution {
  action: ViolationResolutionAction;
  resolvedByAdminId: number;
  resolvedAt: string;
  note?: string;
}

export interface ViolationReport {
  reportId: number;
  type: ViolationReportType;
  // Author of the offending content (the user who will be punished if a
  // suspension action is selected).
  targetAuthorId: number;
  targetAuthorName: string;
  // The id of the comment/paper being reported.
  targetContentId: number;
  // The exact highlighted snippet shown in the resolution modal.
  reportedContent: string;
  reason: string;
  reportedById: number;
  reportedByName: string;
  date: string;
  status: ViolationReportStatus;
  resolution?: ViolationResolution;
}

export interface ViolationReportsQuery {
  search?: string;
  status?: ViolationReportStatus | 'ALL';
  type?: ViolationReportType | 'ALL';
}

// Object-payload signature for `resolveViolation` — preferred when calling
// from new code (UI handlers, automated tests). The legacy positional form
// `(reportId, action, note)` still works for backward compatibility with the
// existing callers in ContentReports.tsx and adminAuxiliary.service.test.ts.
//
// `action` accepts the DB-aligned ViolationResolutionAction values
// (`DISMISS | DELETE_CONTENT_WARN | DELETE_CONTENT_SUSPEND_14D`), not the
// shorter spec pseudo-enum — see adminAuxiliary.service.ts for the dispatch.
export interface ResolveReportPayload {
  reportId: number;
  action: ViolationResolutionAction;
  resolutionNotes?: string;
}

// ── Premium packages (Figma screens 9 + 10) ────────────────────────────────
export type PremiumPackageTargetRole = 'RESEARCHER' | 'REVIEWER' | 'LECTURER';
export type PremiumPackageBillingCycle = 'Monthly' | 'Yearly';

export interface PremiumPackage {
  packageId: number;
  title: string;
  targetRole: PremiumPackageTargetRole;
  priceVnd: number;
  billingCycle: PremiumPackageBillingCycle;
  features: string[];
  subscriberCount: number;
  isActive: boolean;
}

export interface PremiumPackageInput {
  title: string;
  targetRole: PremiumPackageTargetRole;
  priceVnd: number;
  billingCycle: PremiumPackageBillingCycle;
  features: string[];
  isActive: boolean;
}

// ── Audit logs (Figma screen 11) ───────────────────────────────────────────
// action values must stay in sync with the Figma color tags:
//   green = APPROVED_*, COMPLETED_*
//   red   = DENIED_*, SUSPENDED_*, DELETED_CONTENT_SUSPENDED_14D, DISMISSED_REPORT
//   blue  = *_PACKAGE, TOGGLED_PACKAGE
//   gray  = UNSUSPENDED_ACCOUNT, DELETED_CONTENT_WARNED, TOGGLED_PACKAGE_ACTIVE
export type AuditLogAction =
  | 'APPROVED_ROLE_REQUEST'
  | 'DENIED_ROLE_REQUEST'
  | 'APPROVED_WITHDRAWAL'
  | 'DENIED_WITHDRAWAL'
  | 'COMPLETED_WITHDRAWAL'
  | 'SUSPENDED_ACCOUNT'
  | 'UNSUSPENDED_ACCOUNT'
  | 'CREATED_PACKAGE'
  | 'UPDATED_PACKAGE'
  | 'DELETED_PACKAGE'
  | 'TOGGLED_PACKAGE'
  | 'DISMISSED_REPORT'
  | 'DELETED_CONTENT_WARNED'
  | 'DELETED_CONTENT_SUSPENDED_14D';

export interface AuditLogEntry {
  logId: number;
  adminId: number;
  adminName: string;
  action: AuditLogAction;
  // Human-readable label, e.g. "User #14 / Pham Minh Duc"
  target: string;
  targetId: number;
  timestamp: string;
  details: string;
}

export type AuditLogRange = 'past_24h' | 'past_7d' | 'past_30d' | 'all_time';

export interface AuditLogQuery {
  search?: string;
  adminId?: number | 'ALL';
  range?: AuditLogRange;
}

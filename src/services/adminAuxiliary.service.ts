import api from './axios';
import { API_ENDPOINTS, REPORT } from '../utils/constants';
import type {
  ViolationReport,
  ViolationReportsQuery,
  PremiumPackage,
  PremiumPackageInput,
  AuditLogEntry,
  AuditLogQuery,
  ResolveReportPayload,
} from '../types/adminAuxiliary';

export class AdminBackendContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminBackendContractError';
  }
}

interface ReportApiRow {
  reportId: number;
  reporterId?: number | null;
  targetType?: string | null;
  targetId?: number | null;
  reason?: string | null;
  status?: string | null;
  violationNotes?: string | null;
  createdAt?: string | null;
}

interface PremiumPackageApiRow {
  id: number;
  title?: string | null;
  targetRole?: string | null;
  priceVnd: number;
  billingCycle?: string | null;
  features?: string[] | null;
  isActive: boolean;
  subscriberCount: number;
}

const mapReport = (row: ReportApiRow): ViolationReport => ({
  reportId: row.reportId,
  type: row.targetType?.toUpperCase().includes('PAPER')
    ? 'RESEARCH_PAPER'
    : 'FORUM_COMMENT',
  targetAuthorId: 0,
  targetAuthorName: 'Author details unavailable',
  targetContentId: row.targetId ?? 0,
  reportedContent: row.violationNotes?.trim() || 'Content preview unavailable',
  reason: row.reason?.trim() || 'No reason supplied',
  reportedById: row.reporterId ?? 0,
  reportedByName: row.reporterId ? `User #${row.reporterId}` : 'Reporter unavailable',
  date: row.createdAt ?? '',
  status:
    row.status?.toUpperCase() === 'RESOLVED'
      ? 'RESOLVED'
      : row.status?.toUpperCase() === 'DISMISSED'
        ? 'DISMISSED'
        : 'PENDING',
});

const mapPremiumPackage = (row: PremiumPackageApiRow): PremiumPackage | null => {
  const targetRole = row.targetRole?.toUpperCase();
  if (targetRole !== 'RESEARCHER' && targetRole !== 'REVIEWER' && targetRole !== 'LECTURER') return null;
  if (row.billingCycle !== 'Monthly' && row.billingCycle !== 'Yearly') return null;
  return {
    packageId: row.id,
    title: row.title?.trim() || `Package #${row.id}`,
    targetRole,
    priceVnd: row.priceVnd,
    billingCycle: row.billingCycle,
    features: row.features ?? [],
    subscriberCount: row.subscriberCount,
    isActive: row.isActive,
  };
};

const requirePremiumPackage = (row: PremiumPackageApiRow): PremiumPackage => {
  const mapped = mapPremiumPackage(row);
  if (!mapped) throw new AdminBackendContractError('The backend returned an invalid subscription package.');
  return mapped;
};

// ── Violation reports ─────────────────────────────────────────────────────
async function getViolationReports(query: ViolationReportsQuery = {}): Promise<ViolationReport[]> {
  const response = await api.get<ReportApiRow[]>(REPORT.GET_ALL);
  return (response.data ?? []).map(mapReport).filter((r) => {
    if (query.status && query.status !== 'ALL' && r.status !== query.status) return false;
    if (query.type && query.type !== 'ALL' && r.type !== query.type) return false;
    if (query.search) {
      const q = query.search.toLowerCase();
      const hay = `${r.reason} ${r.targetAuthorName} ${r.reportedByName} ${r.reportId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Resolves a violation report. The 14-day-suspend action also suspends the
 * target author's account via the existing adminService, with `suspendedUntil`
 * set to "now + 14 days" so AccountsManagement can surface the lift date.
 */
async function resolveViolation(
  payload: ResolveReportPayload,
): Promise<ViolationReport> {
  return resolveViolationByPayload(payload);
}

/**
 * Internal resolver — single implementation that all entry points funnel
 * through. Keep the side-effect logic (audit log + 14-day suspend) in one
 * place so the API response mapping and mutation behavior can't drift.
 */
async function resolveViolationByPayload(
  payload: ResolveReportPayload,
): Promise<ViolationReport> {
  const { reportId, action, resolutionNotes } = payload;
  if (action !== 'DISMISS') {
    throw new AdminBackendContractError(
      'Content deletion and account suspension require an atomic backend resolution endpoint. See tickets/backend/BE_ADMIN_REPORT_RESOLUTION_API_TICKET.md.',
    );
  }
  const response = await api.put<ReportApiRow>(
    REPORT.UPDATE(reportId),
    { status: 'Dismissed', violationNotes: resolutionNotes ?? '' },
  );
  return mapReport(response.data);
}

// ── Subscription packages ──────────────────────────────────────────────────
async function getPremiumPackages(): Promise<PremiumPackage[]> {
  const response = await api.get<PremiumPackageApiRow[]>(API_ENDPOINTS.ADMIN.PACKAGES.GET_ALL);
  return (response.data ?? []).map(mapPremiumPackage).filter((item): item is PremiumPackage => item !== null);
}

async function createPremiumPackage(input: PremiumPackageInput): Promise<PremiumPackage> {
  const response = await api.post<PremiumPackageApiRow>(
    API_ENDPOINTS.ADMIN.PACKAGES.CREATE,
    input,
  );
  return requirePremiumPackage(response.data);
}

async function updatePremiumPackage(
  id: number,
  patch: Partial<PremiumPackageInput>,
): Promise<PremiumPackage> {
  const response = await api.patch<PremiumPackageApiRow>(
    API_ENDPOINTS.ADMIN.PACKAGES.UPDATE(id),
    patch,
  );
  return requirePremiumPackage(response.data);
}

async function togglePremiumPackage(id: number, isActive: boolean): Promise<PremiumPackage> {
  const response = await api.post<PremiumPackageApiRow>(
    API_ENDPOINTS.ADMIN.PACKAGES.TOGGLE(id),
    { isActive },
  );
  return requirePremiumPackage(response.data);
}

async function deletePremiumPackage(id: number): Promise<void> {
  await api.delete(API_ENDPOINTS.ADMIN.PACKAGES.DELETE(id));
}

// ── Audit logs ────────────────────────────────────────────────────────────
async function getAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogEntry[]> {
  // Live API path — returns a paged result; page handles client-side pagination.
  const response = await api.get<{
    items: Array<{
      logId: number;
      adminId: number;
      adminName: string;
      action: string;
      target: string;
      targetId: number | string;
      details: string;
      createdAt: string;
    }>;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
  }>(API_ENDPOINTS.ADMIN.AUDIT_LOGS.GET_ALL, {
    params: {
      search: query.search || undefined,
      adminId: query.adminId !== undefined && query.adminId !== 'ALL' ? query.adminId : undefined,
      range: query.range ?? undefined,
      PageNumber: 1,
      PageSize: 1000,
    },
  });
  const rawItems = response.data?.items ?? [];
  return rawItems.map((item) => ({
    logId: item.logId,
    adminId: item.adminId,
    adminName: item.adminName ?? '',
    action: item.action as AuditLogEntry['action'],
    target: item.target ?? '',
    targetId: typeof item.targetId === 'string' ? parseInt(item.targetId, 10) : item.targetId,
    timestamp: item.createdAt ?? '',
    details: item.details ?? '',
  }));
}

/**
 * Builds a CSV string client-side and triggers a browser download via a Blob.
 * Avoids a heavyweight CSV dependency; quoted/escaped strings are RFC-4180
 * compliant (wrap any field containing `,`, `"`, or newline in `"`, and double
 * internal quotes).
 */
async function exportAuditLogsCsv(query: AuditLogQuery = {}): Promise<string> {
  const response = await api.get<string>(API_ENDPOINTS.ADMIN.AUDIT_LOGS.EXPORT, {
    params: {
      search: query.search || undefined,
      adminId: query.adminId && query.adminId !== 'ALL' ? query.adminId : undefined,
      range: query.range ?? undefined,
    },
    responseType: 'text',
  });
  return response.data;
}

export const adminAuxiliaryService = {
  getViolationReports,
  resolveViolation,
  getPremiumPackages,
  createPremiumPackage,
  updatePremiumPackage,
  togglePremiumPackage,
  deletePremiumPackage,
  getAuditLogs,
  exportAuditLogsCsv,
  // Legacy test doubles may call this name; runtime data is API-backed.
  __resetAdminAuxiliaryMockStores: (): void => undefined,
};

export default adminAuxiliaryService;

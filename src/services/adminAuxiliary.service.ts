import api from './axios';
import { API_ENDPOINTS, REPORT } from '../utils/constants';
import type {
  ViolationReport,
  ViolationReportsQuery,
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

const mapReport = (row: ReportApiRow): ViolationReport => ({
  reportId: row.reportId,
  type: row.targetType?.toUpperCase().includes('PAPER')
    ? 'RESEARCH_PAPER'
    : 'FORUM_COMMENT',
  // The `/api/Report` contract does not expose target-author or reporter
  // display names; the placeholder text below keeps the row honest so admins
  // can tell at a glance which columns the BE hasn't populated yet.
  targetAuthorId: 0,
  targetAuthorName: '—',
  targetContentId: row.targetId ?? 0,
  reportedContent: row.violationNotes?.trim() || '—',
  reason: row.reason?.trim() || '—',
  reportedById: row.reporterId ?? 0,
  reportedByName: row.reporterId ? `User #${row.reporterId}` : '—',
  date: row.createdAt ?? '',
  status:
    row.status?.toUpperCase() === 'RESOLVED'
      ? 'RESOLVED'
      : row.status?.toUpperCase() === 'DISMISSED'
        ? 'DISMISSED'
        : 'PENDING',
});

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
      timestamp?: string | null;
      createdAt?: string | null;
    }>;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
  }>(API_ENDPOINTS.ADMIN.AUDIT_LOGS.GET_ALL, {
    params: {
      search: query.search || undefined,
      adminId: query.adminId !== undefined && query.adminId !== 'ALL' ? query.adminId : undefined,
      // The FE-facing range label matches the live BE contract one-for-one
      // (`past_24h | past_7d | past_30d | all_time`). Pass it through
      // unchanged; Swagger's `today | 7_days | 30_days` aliases are
      // rejected by the running service.
      range: query.range,
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
    // The live Swagger contract exposes `timestamp` as the AuditLogResponse
    // timestamp field. Older payloads (and a few interim BE snapshots) returned
    // it as `createdAt`. Read whichever is populated so the FE never falls back
    // to an empty string and renders "Invalid Date".
    timestamp: item.timestamp ?? item.createdAt ?? '',
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
      range: query.range,
    },
    responseType: 'text',
  });
  return response.data;
}

export const adminAuxiliaryService = {
  getViolationReports,
  resolveViolation,
  getAuditLogs,
  exportAuditLogsCsv,
  // Legacy test doubles may call this name; runtime data is API-backed.
  __resetAdminAuxiliaryMockStores: (): void => undefined,
};

export default adminAuxiliaryService;

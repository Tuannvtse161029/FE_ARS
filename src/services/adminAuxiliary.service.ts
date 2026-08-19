import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import { adminService } from './admin.service';
import { auditLog } from './auditLogStore';
import {
  MOCK_VIOLATION_REPORTS,
  MOCK_PREMIUM_PACKAGES,
  // MOCK_AUDIT_LOG_ENTRIES moved to ./auditLogStore
} from './adminAuxiliary.mocks';
import type {
  ViolationReport,
  ViolationReportsQuery,
  PremiumPackage,
  PremiumPackageInput,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogRange,
  ResolveReportPayload,
} from '../types/adminAuxiliary';

// ── Mock toggle ────────────────────────────────────────────────────────────
// TODO: Replace mock data with live endpoints once the BE ships the
// administrative auxiliary endpoints described in
// docs/local-only/admin-suite-be-gap-report.md (section "Auxiliary modules").
// Flip this to `false` (or remove it entirely) to start hitting axios.
const USE_MOCK_DATA = true;

// AuditLog endpoints shipped through Swagger (live since BE shipped).
const USE_AUDIT_MOCK = false;

const MOCK_LATENCY_MS = 450;

function delay<T>(value: T, ms: number = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Deep clones keep mock mutations local to this module so reloads reset state.
const clone = <T>(value: T): T =>
  value == null || typeof value !== 'object' ? value : JSON.parse(JSON.stringify(value));

// ── In-memory mutable stores ───────────────────────────────────────────────
const violationStore: ViolationReport[] = clone(MOCK_VIOLATION_REPORTS);
const packageStore: PremiumPackage[] = clone(MOCK_PREMIUM_PACKAGES);

let nextPackageId = 9500;

const nowIso = () => new Date().toISOString();

const currentAdmin = { id: 0, name: 'Admin User' };

// ── Violation reports ─────────────────────────────────────────────────────
async function getViolationReports(query: ViolationReportsQuery = {}): Promise<ViolationReport[]> {
  const filtered = clone(violationStore).filter((r) => {
    if (query.status && query.status !== 'ALL' && r.status !== query.status) return false;
    if (query.type && query.type !== 'ALL' && r.type !== query.type) return false;
    if (query.search) {
      const q = query.search.toLowerCase();
      const hay = `${r.reason} ${r.targetAuthorName} ${r.reportedByName} ${r.reportId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (USE_MOCK_DATA) return delay(filtered);

  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.get<ViolationReport[]>(API_ENDPOINTS.ADMIN.REPORTS.GET_ALL, {
    params: {
      search: query.search || undefined,
      status: query.status && query.status !== 'ALL' ? query.status : undefined,
      type: query.type && query.type !== 'ALL' ? query.type : undefined,
    },
  });
  return response.data ?? [];
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
 * place so the mock and live paths can't drift.
 */
async function resolveViolationByPayload(
  payload: ResolveReportPayload,
): Promise<ViolationReport> {
  const { reportId, action, resolutionNotes: note } = payload;
  if (USE_MOCK_DATA) {
    const idx = violationStore.findIndex((r) => r.reportId === reportId);
    if (idx === -1) {
      await delay(null);
      throw new Error(`Violation report ${reportId} not found`);
    }
    const report = violationStore[idx];
    const resolutionActionStatus =
      action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';

    const updated: ViolationReport = {
      ...report,
      status: resolutionActionStatus,
      resolution: {
        action,
        resolvedByAdminId: currentAdmin.id,
        resolvedAt: nowIso(),
        note,
      },
    };
    violationStore[idx] = updated;

    // Side effects: audit entry (always) + 14-day suspend (sometimes).
    auditLog.append({
      adminId: currentAdmin.id,
      adminName: currentAdmin.name,
      action:
        action === 'DISMISS'
          ? 'DISMISSED_REPORT'
          : action === 'DELETE_CONTENT_WARN'
          ? 'DELETED_CONTENT_WARNED'
          : 'DELETED_CONTENT_SUSPENDED_14D',
      target: `Report #${report.reportId} / ${report.targetAuthorName}`,
      targetId: report.reportId,
      details: note ?? '',
    });

    if (action === 'DELETE_CONTENT_SUSPEND_14D') {
      const suspendedUntil = new Date(Date.now() + 14 * 86_400_000).toISOString();
      await adminService.suspendAccount(report.targetAuthorId, { suspendedUntil });
    }

    return delay(clone(updated));
  }

  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.post<ViolationReport>(
    API_ENDPOINTS.ADMIN.REPORTS.RESOLVE(reportId),
    { action, note: note ?? '' },
  );
  return response.data;
}

// ── Premium packages ───────────────────────────────────────────────────────
async function getPremiumPackages(): Promise<PremiumPackage[]> {
  if (USE_MOCK_DATA) return delay(clone(packageStore));

  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.get<PremiumPackage[]>(API_ENDPOINTS.ADMIN.PACKAGES.GET_ALL);
  return response.data ?? [];
}

async function createPremiumPackage(input: PremiumPackageInput): Promise<PremiumPackage> {
  if (USE_MOCK_DATA) {
    await delay(null);
    const pkg: PremiumPackage = {
      packageId: nextPackageId++,
      ...input,
      subscriberCount: 0,
    };
    packageStore.push(pkg);
    auditLog.append({
      adminId: currentAdmin.id,
      adminName: currentAdmin.name,
      action: 'CREATED_PACKAGE',
      target: `Package #${pkg.packageId} / ${pkg.title}`,
      targetId: pkg.packageId,
      details: `${pkg.priceVnd.toLocaleString('vi-VN')} VND/${pkg.billingCycle.toLowerCase()}; ${pkg.features.length} features.`,
    });
    return clone(pkg);
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.post<PremiumPackage>(
    API_ENDPOINTS.ADMIN.PACKAGES.CREATE,
    input,
  );
  return response.data;
}

async function updatePremiumPackage(
  id: number,
  patch: Partial<PremiumPackageInput>,
): Promise<PremiumPackage> {
  if (USE_MOCK_DATA) {
    const idx = packageStore.findIndex((p) => p.packageId === id);
    if (idx === -1) {
      await delay(null);
      throw new Error(`Package ${id} not found`);
    }
    const updated: PremiumPackage = { ...packageStore[idx], ...patch };
    packageStore[idx] = updated;
    auditLog.append({
      adminId: currentAdmin.id,
      adminName: currentAdmin.name,
      action: 'UPDATED_PACKAGE',
      target: `Package #${updated.packageId} / ${updated.title}`,
      targetId: updated.packageId,
      details: 'Package details updated.',
    });
    return delay(clone(updated));
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.patch<PremiumPackage>(
    API_ENDPOINTS.ADMIN.PACKAGES.UPDATE(id),
    patch,
  );
  return response.data;
}

async function togglePremiumPackage(id: number, isActive: boolean): Promise<PremiumPackage> {
  if (USE_MOCK_DATA) {
    const idx = packageStore.findIndex((p) => p.packageId === id);
    if (idx === -1) {
      await delay(null);
      throw new Error(`Package ${id} not found`);
    }
    const updated: PremiumPackage = { ...packageStore[idx], isActive };
    packageStore[idx] = updated;
    auditLog.append({
      adminId: currentAdmin.id,
      adminName: currentAdmin.name,
      action: 'TOGGLED_PACKAGE',
      target: `Package #${updated.packageId} / ${updated.title}`,
      targetId: updated.packageId,
      details: `Set package status to ${isActive ? 'Active' : 'Inactive'}.`,
    });
    return delay(clone(updated));
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.post<PremiumPackage>(
    API_ENDPOINTS.ADMIN.PACKAGES.TOGGLE(id),
    { isActive },
  );
  return response.data;
}

async function deletePremiumPackage(id: number): Promise<void> {
  if (USE_MOCK_DATA) {
    const idx = packageStore.findIndex((p) => p.packageId === id);
    if (idx === -1) {
      await delay(null);
      throw new Error(`Package ${id} not found`);
    }
    const [removed] = packageStore.splice(idx, 1);
    auditLog.append({
      adminId: currentAdmin.id,
      adminName: currentAdmin.name,
      action: 'DELETED_PACKAGE',
      target: `Package #${removed.packageId} / ${removed.title}`,
      targetId: removed.packageId,
      details: 'Package removed.',
    });
    return;
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  await api.delete(API_ENDPOINTS.ADMIN.PACKAGES.DELETE(id));
}

// ── Audit logs ────────────────────────────────────────────────────────────
const RANGE_MS: Record<AuditLogRange, number | null> = {
  past_24h: 24 * 3_600_000,
  past_7d: 7 * 86_400_000,
  past_30d: 30 * 86_400_000,
  all_time: null,
};

async function getAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogEntry[]> {
  if (USE_AUDIT_MOCK) {
    const all = auditLog.snapshot();
    const sorted = [...all].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const filtered = sorted.filter((entry) => {
      if (query.adminId !== undefined && query.adminId !== 'ALL' && entry.adminId !== query.adminId) {
        return false;
      }
      if (query.range && query.range !== 'all_time') {
        const ms = RANGE_MS[query.range];
        if (ms !== null) {
          const cutoff = Date.now() - ms;
          if (new Date(entry.timestamp).getTime() < cutoff) return false;
        }
      }
      if (query.search) {
        const q = query.search.toLowerCase();
        const hay =
          `${entry.logId} ${entry.adminId} ${entry.target} ${entry.action} ${entry.details}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return delay(filtered);
  }

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
  const rows = await getAuditLogs(query);
  const header = ['LOG_ID', 'TIMESTAMP', 'ADMIN_ID', 'ADMIN_NAME', 'ACTION', 'TARGET_ID', 'TARGET', 'DETAILS'];
  const csv = [header.join(',')]
    .concat(
      rows.map((r) =>
        [
          r.logId,
          r.timestamp,
          r.adminId,
          r.adminName,
          r.action,
          r.targetId,
          r.target,
          r.details,
        ]
          .map(csvField)
          .join(','),
      ),
    )
    .join('\r\n');

  if (USE_MOCK_DATA) return delay(csv);

  // TODO: Replace mock data with live endpoint once backend is updated.
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

function csvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Test helper ───────────────────────────────────────────────────────────
export const __resetAdminAuxiliaryMockStores = () => {
  violationStore.splice(0, violationStore.length, ...clone(MOCK_VIOLATION_REPORTS));
  packageStore.splice(0, packageStore.length, ...clone(MOCK_PREMIUM_PACKAGES));
  auditLog.reset();
  nextPackageId = 9500;
};

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
  __resetAdminAuxiliaryMockStores,
};

export default adminAuxiliaryService;

import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import { notificationService } from './notification.service';
import { auditLog } from './auditLogStore';
import {
  MOCK_ROLE_REQUESTS,
  MOCK_ACCOUNTS,
  MOCK_WITHDRAWALS,
  MOCK_ANALYTICS_SUMMARY,
  buildMockTimeseries,
} from './admin.mocks';
import type {
  RoleRequest,
  RoleRequestDecision,
  AccountItem,
  AccountsQuery,
  WithdrawalRequestItem,
  AnalyticsSummary,
  AnalyticsTimeSeries,
  AnalyticsRange,
  AnalyticsMetric,
} from '../types/admin';

// ── Mock toggle ────────────────────────────────────────────────────────────
// TODO: Replace mock data with live endpoints once the BE ships the admin
// endpoints described in docs/local-only/admin-suite-be-gap-report.md.
// Flip this to `false` (or remove it entirely) to start hitting axios.
const USE_MOCK_DATA = true;

// Simulated latency so loading skeletons actually render.
const MOCK_LATENCY_MS = 450;

function delay<T>(value: T, ms: number = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Deep clones keep mock mutations local to this module so reloads reset state.
const clone = <T>(value: T): T =>
  value == null || typeof value !== 'object' ? value : JSON.parse(JSON.stringify(value));

// In-memory mutable copies of the mock fixtures.
const roleRequestStore: RoleRequest[] = clone(MOCK_ROLE_REQUESTS);
const accountStore: AccountItem[] = clone(MOCK_ACCOUNTS);
const withdrawalStore: WithdrawalRequestItem[] = clone(MOCK_WITHDRAWALS);

// Test-only helper. Resets in-memory mock stores to their fixture defaults.
// Safe to call in production: USE_MOCK_DATA guards the actual fixtures in dev.
export const __resetAdminMockStores = () => {
  roleRequestStore.splice(0, roleRequestStore.length, ...clone(MOCK_ROLE_REQUESTS));
  accountStore.splice(0, accountStore.length, ...clone(MOCK_ACCOUNTS));
  withdrawalStore.splice(0, withdrawalStore.length, ...clone(MOCK_WITHDRAWALS));
};

// ── Role requests ──────────────────────────────────────────────────────────
async function getRoleRequests(): Promise<RoleRequest[]> {
  if (USE_MOCK_DATA) return delay(clone(roleRequestStore));
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.get<RoleRequest[]>(API_ENDPOINTS.ADMIN.ROLE_REQUESTS.GET_ALL);
  return response.data ?? [];
}

async function getRoleRequest(id: number): Promise<RoleRequest | null> {
  if (USE_MOCK_DATA) {
    const hit = roleRequestStore.find((r) => r.id === id);
    return delay(hit ? clone(hit) : null);
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.get<RoleRequest>(API_ENDPOINTS.ADMIN.ROLE_REQUESTS.GET_BY_ID(id));
  return response.data ?? null;
}

async function decideRoleRequest(
  id: number,
  decision: RoleRequestDecision,
): Promise<RoleRequest> {
  if (USE_MOCK_DATA) {
    const idx = roleRequestStore.findIndex((r) => r.id === id);
    if (idx === -1) {
      await delay(null);
      throw new Error(`Role request ${id} not found`);
    }
    const updated: RoleRequest = { ...roleRequestStore[idx], ...decision };
    roleRequestStore[idx] = updated;
    auditLog.append({
      adminId: 0,
      adminName: 'Admin User',
      action: updated.status === 'APPROVED' ? 'APPROVED_ROLE_REQUEST' : 'DENIED_ROLE_REQUEST',
      target: `User #${updated.userId} / ${updated.userName}`,
      targetId: updated.userId,
      details: updated.notes ?? '',
    });

    // When the Admin approves a role request, mirror the BE-side
    // `dbo.Users.isActive = true` flip on the matching AccountItem so the
    // mock store stays consistent with what a real BE would do. Match by
    // userId first, then by email as a fallback for users who don't yet
    // have an AccountItem row (newly-registered users get one created
    // by the BE on first login).
    if (updated.status === 'APPROVED') {
      const accountIdx = accountStore.findIndex((a) => a.id === updated.userId);
      if (accountIdx !== -1) {
        accountStore[accountIdx] = {
          ...accountStore[accountIdx],
          isActive: true,
        };
      } else {
        const emailIdx = accountStore.findIndex(
          (a) => a.email.toLowerCase() === updated.email.toLowerCase(),
        );
        if (emailIdx !== -1) {
          accountStore[emailIdx] = {
            ...accountStore[emailIdx],
            isActive: true,
          };
        }
      }
    }

    return delay(clone(updated));
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const path =
    decision.status === 'APPROVED'
      ? API_ENDPOINTS.ADMIN.ROLE_REQUESTS.APPROVE(id)
      : API_ENDPOINTS.ADMIN.ROLE_REQUESTS.DENY(id);
  const response = await api.post<RoleRequest>(path, { notes: decision.notes ?? '' });
  return response.data;
}

// ── Accounts ───────────────────────────────────────────────────────────────
async function getAccounts(query: AccountsQuery = {}): Promise<AccountItem[]> {
  const filterFn = (a: AccountItem) => {
    if (query.search) {
      const q = query.search.toLowerCase();
      const hay = `${a.name} ${a.email} ${a.id}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (query.role && query.role !== 'ALL' && !a.roles.includes(query.role)) return false;
    if (query.plan && query.plan !== 'ALL' && a.plan !== query.plan) return false;
    if (query.status && query.status !== 'ALL' && a.status !== query.status) return false;
    return true;
  };

  if (USE_MOCK_DATA) return delay(clone(accountStore).filter(filterFn));

  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.get<AccountItem[]>(API_ENDPOINTS.ADMIN.ACCOUNTS.GET_ALL, {
    params: {
      search: query.search || undefined,
      role: query.role && query.role !== 'ALL' ? query.role : undefined,
      plan: query.plan && query.plan !== 'ALL' ? query.plan : undefined,
      status: query.status && query.status !== 'ALL' ? query.status : undefined,
    },
  });
  return response.data ?? [];
}

async function suspendAccount(
  id: number,
  options?: { suspendedUntil?: string },
): Promise<AccountItem> {
  return mutateAccount(id, 'SUSPENDED', 'suspend', options);
}

async function unsuspendAccount(id: number): Promise<AccountItem> {
  return mutateAccount(id, 'ACTIVE', 'unsuspend');
}

async function mutateAccount(
  id: number,
  status: AccountItem['status'],
  endpoint: 'suspend' | 'unsuspend',
  options?: { suspendedUntil?: string },
): Promise<AccountItem> {
  if (USE_MOCK_DATA) {
    const idx = accountStore.findIndex((a) => a.id === id);
    if (idx === -1) {
      await delay(null);
      throw new Error(`Account ${id} not found`);
    }
    const updated: AccountItem = {
      ...accountStore[idx],
      status,
      suspendedUntil:
        status === 'SUSPENDED'
          ? options?.suspendedUntil ?? accountStore[idx].suspendedUntil ?? null
          : null,
    };
    accountStore[idx] = updated;
    auditLog.append({
      adminId: 0,
      adminName: 'Admin User',
      action: status === 'SUSPENDED' ? 'SUSPENDED_ACCOUNT' : 'UNSUSPENDED_ACCOUNT',
      target: `User #${updated.id} / ${updated.name}`,
      targetId: updated.id,
      details: options?.suspendedUntil
        ? `Suspended until ${new Date(options.suspendedUntil).toLocaleDateString('vi-VN')}.`
        : '',
    });
    return delay(clone(updated));
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const path =
    endpoint === 'suspend'
      ? API_ENDPOINTS.ADMIN.ACCOUNTS.SUSPEND(id)
      : API_ENDPOINTS.ADMIN.ACCOUNTS.UNSUSPEND(id);
  const response = await api.post<AccountItem>(path, options ?? {});
  return response.data;
}

// ── Withdrawals (3-state manual flow) ─────────────────────────────────────
async function getReviewerWithdrawals(): Promise<WithdrawalRequestItem[]> {
  if (USE_MOCK_DATA) return delay(clone(withdrawalStore));
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.get<WithdrawalRequestItem[]>(
    API_ENDPOINTS.ADMIN.WITHDRAWALS.GET_ALL,
  );
  return response.data ?? [];
}

async function markWithdrawalProcessing(id: number): Promise<WithdrawalRequestItem> {
  if (USE_MOCK_DATA) {
    return delay(updateWithdrawal(id, { status: 'ACCEPTED_PROCESSING' }));
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.post<WithdrawalRequestItem>(
    API_ENDPOINTS.ADMIN.WITHDRAWALS.ACCEPT(id),
    {},
  );
  return response.data;
}

/**
 * Completes the withdrawal by moving ACCEPTED_PROCESSING → COMPLETED,
 * posting the receipt URL, and notifying the reviewer. The notification
 * failure is swallowed so the payout flow isn't blocked by email/notification
 * outages (the receipt is the authoritative record).
 */
async function completeWithdrawal(
  id: number,
  proofReceiptUrl: string,
  reviewerId: number,
  reviewerName: string,
  amountVnd: number,
): Promise<WithdrawalRequestItem> {
  if (USE_MOCK_DATA) {
    const updated = updateWithdrawal(id, { status: 'COMPLETED', proofReceiptUrl });
    auditLog.append({
      adminId: 0,
      adminName: 'Admin User',
      action: 'COMPLETED_WITHDRAWAL',
      target: `Withdrawal #${updated.txId} / ${updated.reviewerName}`,
      targetId: updated.txId,
      details: `${updated.amountVnd.toLocaleString('vi-VN')} VND — receipt uploaded`,
    });
    await notifyReviewer(reviewerId, reviewerName, amountVnd).catch(() => undefined);
    return delay(updated);
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.post<WithdrawalRequestItem>(
    API_ENDPOINTS.ADMIN.WITHDRAWALS.COMPLETE(id),
    { proofReceiptUrl },
  );
  await notifyReviewer(reviewerId, reviewerName, amountVnd).catch(() => undefined);
  return response.data;
}

async function denyWithdrawal(id: number, reason: string): Promise<WithdrawalRequestItem> {
  if (USE_MOCK_DATA) {
    const updated = updateWithdrawal(id, { status: 'DENIED', rejectionReason: reason });
    auditLog.append({
      adminId: 0,
      adminName: 'Admin User',
      action: 'DENIED_WITHDRAWAL',
      target: `Withdrawal #${updated.txId} / ${updated.reviewerName}`,
      targetId: updated.txId,
      details: reason,
    });
    return delay(updated);
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.post<WithdrawalRequestItem>(
    API_ENDPOINTS.ADMIN.WITHDRAWALS.DENY(id),
    { reason },
  );
  return response.data;
}

function updateWithdrawal(
  id: number,
  patch: Partial<WithdrawalRequestItem>,
): WithdrawalRequestItem {
  const idx = withdrawalStore.findIndex((w) => w.txId === id);
  if (idx === -1) throw new Error(`Withdrawal ${id} not found`);
  const updated: WithdrawalRequestItem = { ...withdrawalStore[idx], ...patch };
  withdrawalStore[idx] = updated;
  return updated;
}

async function notifyReviewer(
  userId: number,
  reviewerName: string,
  amountVnd: number,
): Promise<void> {
  const formatted = amountVnd.toLocaleString('vi-VN');
  await notificationService.create({
    userId,
    message: `Your withdrawal of ${formatted} VND has been completed. The transfer receipt is attached for your records.`,
    isRead: false,
  });
  // `reviewerName` is accepted so we can swap to a personalized copy
  // when BE grows a templated-message endpoint; the mock path doesn't use it.
  void reviewerName;
}

// ── Analytics ──────────────────────────────────────────────────────────────
async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  if (USE_MOCK_DATA) return delay(MOCK_ANALYTICS_SUMMARY);
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.get<AnalyticsSummary>(API_ENDPOINTS.ANALYTICS.SUMMARY);
  return response.data;
}

async function getAnalyticsTimeseries(
  range: AnalyticsRange,
  metric: AnalyticsMetric,
): Promise<AnalyticsTimeSeries> {
  if (USE_MOCK_DATA) return delay(buildMockTimeseries(range, metric));
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.get<AnalyticsTimeSeries>(API_ENDPOINTS.ANALYTICS.TIMESERIES, {
    params: { range, metric },
  });
  return response.data;
}

export const adminService = {
  getRoleRequests,
  getRoleRequest,
  decideRoleRequest,
  getAccounts,
  suspendAccount,
  unsuspendAccount,
  getReviewerWithdrawals,
  markWithdrawalProcessing,
  completeWithdrawal,
  denyWithdrawal,
  getAnalyticsSummary,
  getAnalyticsTimeseries,
  // Dev-only escape hatch for the test suite.
  __resetAdminMockStores,
};

export default adminService;

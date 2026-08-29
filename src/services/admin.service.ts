import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import { AppConfig } from '../config/app';
import { WithdrawalFeatureDisabledError } from './withdrawal.service';
import type { User } from '../types/auth';
import { notificationService } from './notification.service';
import { auditLog } from './auditLogStore';
import { userService } from './user.service';
import {
  MOCK_ROLE_REQUESTS,
  MOCK_ACCOUNTS,
  MOCK_WITHDRAWALS,
  MOCK_ANALYTICS_SUMMARY,
  buildMockTimeseries,
} from '../../tests/mocks/admin.mocks';
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
// WARNING: Existing admin.service.test.ts mocks axios globally — when flipping
// to false, those tests must also mock the axios paths for each method.
const USE_MOCK_DATA = false;

// Analytics surfaced through the live Swagger endpoints (live since BE shipped).
const USE_ANALYTICS_MOCK = false;

// Withdrawal-only narrow toggle (E2E override point). Defaults to true so
// the existing Admin UX continues to render against the in-memory mock store
// when no env is set. E2E suites can force the live axios path via either:
//   1. Build-time: export `VITE_USE_ADMIN_WITHDRAWAL_MOCK=false` before the
//      Vite build (works for locally-hosted dev runs).
//   2. Runtime shim: set `window.__USE_ADMIN_WITHDRAWAL_MOCK__ = 'false'`
//      from a Playwright `addInitScript` (works against the Vercel-built
//      bundle where the env var was inlined at build time and we cannot
//      change it without a redeploy).
// The runtime shim takes precedence so E2E overrides always win.
// See docs/local-only/agent-7-e2e-findings.md.
const runtimeOverride =
  typeof window !== 'undefined'
    ? (window as unknown as { __USE_ADMIN_WITHDRAWAL_MOCK__?: string })
        .__USE_ADMIN_WITHDRAWAL_MOCK__
    : undefined;
const USE_WITHDRAWAL_MOCK =
  runtimeOverride !== undefined
    ? runtimeOverride !== 'false'
    : import.meta.env.VITE_USE_ADMIN_WITHDRAWAL_MOCK !== 'false';

// Centralized withdrawal feature gate — mirrors withdrawal.service.ts. While
// the flag is off, every admin-side withdrawal mutation short-circuits with
// `WithdrawalFeatureDisabledError` so a stale visible UI cannot complete
// payouts or deny requests. Restore by re-enabling the flag in
// src/config/app.ts (AppConfig.features.enableWithdrawals = true).
const guardAdminWithdrawalCall = (method: string) => {
  if (AppConfig.features.enableWithdrawals !== true) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[adminService] ${method} blocked: withdrawal feature is disabled.`);
    }
    throw new WithdrawalFeatureDisabledError();
  }
};

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

// Surface-level messages: NEVER leak raw axios messages to admins.
const ROLE_REQUESTS_UNAVAILABLE =
  'Role requests could not be loaded. The Admin API contract may have changed.';
const ACTION_FAILED_MESSAGE =
  'The action could not be completed. Please try again.';

// Returns true when the error message looks like an axios boilerplate line
// (e.g. "Request failed with status code 404") that the FE should NEVER
// surface verbatim. Domain messages like "Role request 99999 not found" pass
// through so callers/tests can still inspect them.
const isAxiosBoilerplate = (message: string): boolean =>
  /request failed with status code/i.test(message) ||
  /^network error$/i.test(message) ||
  /^timeout of \d+ms exceeded$/i.test(message);

const logDiag = (label: string, err: unknown) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[adminService] ${label}:`, err);
  }
};

const sanitize = (fallback: string, err: unknown): Error => {
  if (err instanceof Error) {
    if (!isAxiosBoilerplate(err.message)) return err;
    const wrapped = new Error(fallback);
    (wrapped as Error & { cause?: unknown }).cause = err;
    return wrapped;
  }
  return new Error(fallback);
};

// ── Role requests ──────────────────────────────────────────────────────────
async function getRoleRequests(signal?: AbortSignal): Promise<RoleRequest[]> {
  if (USE_MOCK_DATA) return delay(clone(roleRequestStore));
  try {
    const response = await api.get<any>(
      API_ENDPOINTS.ADMIN.ROLE_REQUESTS.GET_ALL,
      { signal },
    );
    const raw = response.data;
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
    return list.map((item: any) => ({
      id: item.id,
      userId: item.userId ?? item.id,
      userName: item.userName || item.fullName || `User #${item.userId ?? item.id}`,
      email: item.email || '',
      phone: item.phone || '',
      affiliation: item.affiliation || '',
      department: item.department || '',
      currentRoles: Array.isArray(item.currentRoles) ? item.currentRoles : item.roleName ? [item.roleName] : [],
      requestedAdditionalRoles: Array.isArray(item.requestedAdditionalRoles)
        ? item.requestedAdditionalRoles
        : Array.isArray(item.requestedRoles)
          ? item.requestedRoles
          : item.requestedRole
            ? [item.requestedRole]
            : [],
      requestType: item.requestType || 'INITIAL_REGISTRATION',
      requestedRoles: Array.isArray(item.requestedRoles)
        ? item.requestedRoles
        : Array.isArray(item.requestedAdditionalRoles)
          ? item.requestedAdditionalRoles
          : [],
      proofDocumentUrl: item.proofDocumentUrl || '',
      submissionDate: item.submissionDate || item.createdAt || new Date().toISOString(),
      status: (item.status?.toUpperCase() === 'APPROVED' || item.status?.toUpperCase() === 'ACCEPTED')
        ? 'APPROVED'
        : (item.status?.toUpperCase() === 'DENIED' || item.status?.toUpperCase() === 'REJECTED')
          ? 'DENIED'
          : 'PENDING',
      notes: item.notes || '',
    }));
  } catch (err) {
    if ((err as { name?: string })?.name === 'CanceledError') throw err;
    logDiag('getRoleRequests failed', err);
    throw sanitize(ROLE_REQUESTS_UNAVAILABLE, err);
  }
}

async function getRoleRequest(id: number): Promise<RoleRequest | null> {
  if (USE_MOCK_DATA) {
    const hit = roleRequestStore.find((r) => r.id === id);
    return delay(hit ? clone(hit) : null);
  }
  try {
    const response = await api.get<RoleRequest>(API_ENDPOINTS.ADMIN.ROLE_REQUESTS.GET_BY_ID(id));
    return response.data ?? null;
  } catch (err) {
    if ((err as { name?: string })?.name === 'CanceledError') throw err;
    logDiag(`getRoleRequest(${id}) failed`, err);
    throw sanitize(ACTION_FAILED_MESSAGE, err);
  }
}

async function decideRoleRequest(
  id: number,
  decision: RoleRequestDecision,
  email?: string,
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
  try {
    const path =
      decision.status === 'APPROVED'
        ? API_ENDPOINTS.ADMIN.ROLE_REQUESTS.APPROVE(id)
        : API_ENDPOINTS.ADMIN.ROLE_REQUESTS.DENY(id);
    const response = await api.post<any>(path, {
      notes: decision.notes ?? (decision.status === 'APPROVED' ? 'Hồ sơ hợp lệ' : ''),
    });

    // If approved and email is supplied, optionally trigger the send-approval-email endpoint
    if (decision.status === 'APPROVED' && email) {
      try {
        await api.post(`/api/Auth/send-approval-email`, null, {
          params: { email },
        });
      } catch (emailErr) {
        logDiag('sendApprovalEmail failed', emailErr);
      }
    }

    const resData = response.data;
    return (
      resData && typeof resData === 'object' && resData.id
        ? resData
        : { id, status: decision.status, notes: decision.notes }
    ) as RoleRequest;
  } catch (err: any) {
    if ((err as { name?: string })?.name === 'CanceledError') throw err;
    logDiag(`decideRoleRequest(${id}) failed`, err);
    const backendMsg = err?.response?.data?.message || err?.message;
    throw sanitize(backendMsg || ACTION_FAILED_MESSAGE, err);
  }
}

// ── Accounts ───────────────────────────────────────────────────────────────

// Normalize a raw User row (from /api/user) into the AccountItem shape the
// AccountsManagement page expects.  The live API returns the dbo.Users
// columns verbatim; the two shapes differ in field names so a mapping is
// unavoidable.  Role is stored as roleName on the row; plan maps
// accountTier (null → FREE_TIER); status maps isActive (true → ACTIVE).
function userToAccountItem(user: User): AccountItem {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    roles: [user.roleName as AccountItem['roles'][number]],
    plan: (user.accountTier ?? 'Free') === 'Free' ? 'FREE_TIER' : 'PREMIUM',
    status: user.isActive ? 'ACTIVE' : 'SUSPENDED',
    joinedDate: user.createdAt ?? new Date().toISOString(),
    isActive: user.isActive,
    // Carry through the BE-reported suspension deadline so the
    // AccountsManagement page can render the "Suspended until …" pill.
    // The mock store synthesizes its own value via the violation-resolution
    // path; live responses surface whatever `dbo.Users.suspendedUntil` holds.
    suspendedUntil: user.suspendedUntil ?? null,
  };
}

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

  // Agent 29 (BTR-AGENT29-A): the User API does not yet support a
  // server-side search / role / plan / status filter. Walk every backend
  // page (capped by `MAX_USER_FETCH_PAGES`) so the Admin accounts table
  // reflects the full directory, and apply the client-side filter on top.
  const { items } = await userService.getAllUsers();
  return items
    .map(userToAccountItem)
    .filter(filterFn);
}

async function suspendAccount(
  id: number,
  options?: { suspendedUntil?: string },
): Promise<AccountItem> {
  return mutateAccount(id, false, options);
}

async function unsuspendAccount(id: number): Promise<AccountItem> {
  return mutateAccount(id, true);
}

/**
 * Mutate an account's active state via the documented `PUT /api/User/{id}`
 * mutation. The `UserUpdateRequest` contract requires `fullName`
 * (`swagger.json:6161-6181`) — we must read the current record first so
 * the PUT body never blanks unrelated fields. The mutation is
 * server-confirmation only: no optimistic flip on the FE side.
 *
 * Returns the refetched AccountItem so callers can rely on `isActive`
 * matching what the BE now has on disk.
 */
async function mutateAccount(
  id: number,
  isActive: boolean,
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
      status: isActive ? 'ACTIVE' : 'SUSPENDED',
      suspendedUntil:
        isActive
          ? null
          : options?.suspendedUntil ?? accountStore[idx].suspendedUntil ?? null,
    };
    accountStore[idx] = updated;
    auditLog.append({
      adminId: 0,
      adminName: 'Admin User',
      action: isActive ? 'UNSUSPENDED_ACCOUNT' : 'SUSPENDED_ACCOUNT',
      target: `User #${updated.id} / ${updated.name}`,
      targetId: updated.id,
      details: options?.suspendedUntil
        ? `Suspended until ${new Date(options.suspendedUntil).toLocaleDateString('vi-VN')}.`
        : '',
    });
    return delay(clone(updated));
  }
  try {
    // Issue `PUT /api/User/{id}` with `isActive` as the only mutation. The
    // helper reads the current User record first and constructs a full
    // body so we never overwrite unrelated columns.
    // If the BE has a separate `suspendedUntil` deadline, fold it into the
    // next evolution of `UserUpdateRequest`. For now the helper only
    // mutates `isActive`; the `options.suspendedUntil` is preserved for
    // future BE growth.
    void options;
    await userService.updateIsActive(id, isActive);
    const refreshed = await userService.getById(id);
    return userToAccountItem(refreshed);
  } catch (err) {
    if ((err as { name?: string })?.name === 'CanceledError') throw err;
    logDiag(`mutateAccount(${id}, ${isActive}) failed`, err);
    throw sanitize(ACTION_FAILED_MESSAGE, err);
  }
}

// ── Withdrawals (3-state manual flow) ─────────────────────────────────────
// Normalize a raw withdrawal row from either the mock fixture or the live BE
// into the Admin-facing shape. The BE returns the reviewer's submission
// reason as `Note`; the Admin modal reads `requestReason`. We do the mapping
// once here so downstream code never has to handle both spellings. (Phase C
// defect 5 — see WithdrawalRequestItem.requestReason in src/types/admin.ts.)
//
// Exported so tests can verify the normalization in isolation without going
// through the full mock store.
export const normalizeWithdrawalItem = (
  raw: WithdrawalRequestItem,
): WithdrawalRequestItem => {
  const { note, ...rest } = raw;
  void note; // explicit "we intentionally discard `note` after extraction"
  const requestReason =
    raw.requestReason !== undefined && raw.requestReason !== null
      ? raw.requestReason
      : raw.note !== undefined && raw.note !== null
        ? raw.note
        : null;
  return { ...rest, requestReason };
};

async function getReviewerWithdrawals(): Promise<WithdrawalRequestItem[]> {
  guardAdminWithdrawalCall('getReviewerWithdrawals');
  if (USE_WITHDRAWAL_MOCK) {
    return delay(clone(withdrawalStore).map(normalizeWithdrawalItem));
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.get<WithdrawalRequestItem[]>(
    API_ENDPOINTS.ADMIN.WITHDRAWALS.GET_ALL,
  );
  return (response.data ?? []).map(normalizeWithdrawalItem);
}

async function markWithdrawalProcessing(id: number): Promise<WithdrawalRequestItem> {
  guardAdminWithdrawalCall('markWithdrawalProcessing');
  if (USE_WITHDRAWAL_MOCK) {
    return delay(
      normalizeWithdrawalItem(
        updateWithdrawal(id, {
          status: 'ACCEPTED_PROCESSING',
          processingAt: new Date().toISOString(),
        }),
      ),
    );
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.post<WithdrawalRequestItem>(
    API_ENDPOINTS.ADMIN.WITHDRAWALS.ACCEPT(id),
    {},
  );
  return normalizeWithdrawalItem(response.data);
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
  guardAdminWithdrawalCall('completeWithdrawal');
  if (USE_WITHDRAWAL_MOCK) {
    const updated = updateWithdrawal(id, {
      status: 'COMPLETED',
      proofReceiptUrl,
      completedAt: new Date().toISOString(),
    });
    auditLog.append({
      adminId: 0,
      adminName: 'Admin User',
      action: 'COMPLETED_WITHDRAWAL',
      target: `Withdrawal #${updated.txId} / ${updated.reviewerName}`,
      targetId: updated.txId,
      details: `${updated.amountVnd.toLocaleString('vi-VN')} VND — receipt uploaded`,
    });
    await notifyReviewer(reviewerId, reviewerName, amountVnd).catch(() => undefined);
    return delay(normalizeWithdrawalItem(updated));
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.post<WithdrawalRequestItem>(
    API_ENDPOINTS.ADMIN.WITHDRAWALS.COMPLETE(id),
    { proofReceiptUrl },
  );
  await notifyReviewer(reviewerId, reviewerName, amountVnd).catch(() => undefined);
  return normalizeWithdrawalItem(response.data);
}

async function denyWithdrawal(id: number, reason: string): Promise<WithdrawalRequestItem> {
  guardAdminWithdrawalCall('denyWithdrawal');
  if (USE_WITHDRAWAL_MOCK) {
    const updated = updateWithdrawal(id, {
      status: 'DENIED',
      rejectionReason: reason,
    });
    auditLog.append({
      adminId: 0,
      adminName: 'Admin User',
      action: 'DENIED_WITHDRAWAL',
      target: `Withdrawal #${updated.txId} / ${updated.reviewerName}`,
      targetId: updated.txId,
      details: reason,
    });
    return delay(normalizeWithdrawalItem(updated));
  }
  // TODO: Replace mock data with live endpoint once backend is updated.
  const response = await api.post<WithdrawalRequestItem>(
    API_ENDPOINTS.ADMIN.WITHDRAWALS.DENY(id),
    { reason },
  );
  return normalizeWithdrawalItem(response.data);
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
async function getAnalyticsSummary(signal?: AbortSignal): Promise<AnalyticsSummary> {
  if (USE_ANALYTICS_MOCK) return delay(MOCK_ANALYTICS_SUMMARY);
  try {
    const response = await api.get<AnalyticsSummary>(
      API_ENDPOINTS.ANALYTICS.SUMMARY,
      { signal },
    );
    return response.data;
  } catch (err) {
    if ((err as { name?: string })?.name === 'CanceledError') throw err;
    logDiag('getAnalyticsSummary failed', err);
    throw sanitize('Data unavailable. Please retry.', err);
  }
}

async function getAnalyticsTimeseries(
  range: AnalyticsRange,
  metric: AnalyticsMetric,
  signal?: AbortSignal,
): Promise<AnalyticsTimeSeries> {
  if (USE_ANALYTICS_MOCK) return delay(buildMockTimeseries(range, metric));
  try {
    const response = await api.get<AnalyticsTimeSeries>(
      API_ENDPOINTS.ANALYTICS.TIMESERIES,
      { params: { range, metric }, signal },
    );
    return response.data;
  } catch (err) {
    if ((err as { name?: string })?.name === 'CanceledError') throw err;
    logDiag(`getAnalyticsTimeseries(${range},${metric}) failed`, err);
    throw sanitize('Data unavailable. Please retry.', err);
  }
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

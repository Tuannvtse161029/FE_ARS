import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { User } from '../types/auth';
import { userService } from './user.service';
import type {
  RoleRequest,
  RoleRequestDecision,
  AccountItem,
  AccountsQuery,
  AnalyticsSummary,
  AnalyticsTimeSeries,
  AnalyticsRange,
  AnalyticsMetric,
} from '../types/admin';

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
function normalizeRoleRequest(item: any): RoleRequest | null {
  const id = Number(item?.id);
  const userId = Number(item?.userId);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(userId) || userId <= 0) return null;
  const rawStatus = typeof item.status === 'string' ? item.status.toUpperCase() : 'PENDING';
  const status = rawStatus === 'APPROVED' || rawStatus === 'ACCEPTED'
    ? 'APPROVED'
    : rawStatus === 'DENIED' || rawStatus === 'REJECTED'
      ? 'DENIED'
      : 'PENDING';
  return {
    id,
    userId,
    userName: typeof item.userName === 'string' ? item.userName : '',
    email: typeof item.email === 'string' ? item.email : '',
    phone: typeof item.phone === 'string' ? item.phone : undefined,
    affiliation: typeof item.affiliation === 'string' ? item.affiliation : '',
    department: typeof item.department === 'string' ? item.department : '',
    currentRoles: Array.isArray(item.currentRoles) ? item.currentRoles.filter((value: unknown): value is string => typeof value === 'string') : [],
    requestedAdditionalRoles: Array.isArray(item.requestedAdditionalRoles) ? item.requestedAdditionalRoles.filter((value: unknown): value is string => typeof value === 'string') : [],
    requestType: item.requestType === 'ADDITIONAL_ROLE' ? 'ADDITIONAL_ROLE' : item.requestType === 'INITIAL_REGISTRATION' ? 'INITIAL_REGISTRATION' : undefined,
    requestedRoles: Array.isArray(item.requestedRoles) ? item.requestedRoles.filter((value: unknown): value is string => typeof value === 'string') : [],
    orcidId: typeof item.orcidId === 'string' ? item.orcidId : null,
    isOrcidVerified: Boolean(item.isOrcidVerified),
    orcidVerifiedAt: typeof item.orcidVerifiedAt === 'string' ? item.orcidVerifiedAt : null,
    proofDocumentUrl: typeof item.proofDocumentUrl === 'string' ? item.proofDocumentUrl : '',
    submissionDate: typeof item.submissionDate === 'string' ? item.submissionDate : '',
    status,
    notes: typeof item.notes === 'string' ? item.notes : undefined,
  };
}

async function getRoleRequests(signal?: AbortSignal): Promise<RoleRequest[]> {
  try {
    const response = await api.get<any>(
      API_ENDPOINTS.ADMIN.ROLE_REQUESTS.GET_ALL,
      { signal },
    );
    const raw = response.data;
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : raw && Array.isArray(raw.items)
        ? raw.items
        : [];
    return list.map(normalizeRoleRequest).filter((item): item is RoleRequest => item !== null);
  } catch (err) {
    if ((err as { name?: string })?.name === 'CanceledError') throw err;
    logDiag('getRoleRequests failed', err);
    throw sanitize(ROLE_REQUESTS_UNAVAILABLE, err);
  }
}

async function getRoleRequest(id: number): Promise<RoleRequest | null> {
  try {
    const response = await api.get<RoleRequest>(API_ENDPOINTS.ADMIN.ROLE_REQUESTS.GET_BY_ID(id));
    return normalizeRoleRequest(response.data);
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
        await api.post(API_ENDPOINTS.AUTH.SEND_APPROVAL_EMAIL, null, {
          params: { email },
        });
      } catch (emailErr) {
        logDiag('sendApprovalEmail failed', emailErr);
      }
    }

    const normalized = normalizeRoleRequest(response.data);
    if (normalized) return normalized;
    const refreshed = await getRoleRequest(id);
    if (!refreshed) throw new Error('The backend did not return the updated role request.');
    return refreshed;
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
  const role = typeof user.roleName === 'string' ? user.roleName.toUpperCase().replace(/\s+/g, '_') : null;
  const roles = role && ['LECTURER', 'RESEARCHER', 'GRADUATE_STUDENT', 'REVIEWER'].includes(role)
    ? [role as AccountItem['roles'][number]]
    : [];
  return {
    id: user.id,
    name: user.fullName ?? '',
    email: user.email,
    roles,
    plan: (user.accountTier ?? 'Free') === 'Free' ? 'FREE_TIER' : 'PREMIUM',
    status: user.isActive ? 'ACTIVE' : 'SUSPENDED',
    joinedDate: user.createdAt ?? '',
    isActive: user.isActive,
    // Carry through the BE-reported suspension deadline so the
    // AccountsManagement page can render the "Suspended until …" pill.
    // Live responses surface whatever `dbo.Users.suspendedUntil` holds.
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

// ── Analytics ──────────────────────────────────────────────────────────────
async function getAnalyticsSummary(signal?: AbortSignal): Promise<AnalyticsSummary> {
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
  getAnalyticsSummary,
  getAnalyticsTimeseries,
  // Kept as a no-op compatibility hook for legacy test doubles. Runtime data
  // no longer uses an in-memory Admin store.
  __resetAdminMockStores: (): void => undefined,
};

export default adminService;

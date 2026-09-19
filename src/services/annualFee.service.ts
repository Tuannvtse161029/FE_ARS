/**
 * Annual Fee service.
 *
 * Handles annual fee management for researchers and lecturers on the platform.
 * Endpoints follow the BE-published contract (BE-ANNUAL-FEE-01):
 *
 *   GET    /api/AnnualFees?PageNumber=&PageSize=&Search=&UserRole=&BillingCycle=&Status=&SortBy=&SortDir=
 *   GET    /api/AnnualFees/active?page=&pageSize=
 *   GET    /api/AnnualFees/{id}
 *   POST   /api/AnnualFees
 *   PUT    /api/AnnualFees/{id}
 *   PATCH  /api/AnnualFees/{id}/toggle
 *   DELETE /api/AnnualFees/{id}
 *   POST   /api/AnnualFees/{id}/purchase
 *   GET    /api/AnnualFees/my-subscription
 *   GET    /api/AnnualFees/my-purchases?page=&pageSize=
 *   GET    /api/AnnualFees/admin/subscriptions?Page=&PageSize=&Search=&Role=&Status=
 *
 * Note the inconsistent parameter casing between endpoints:
 *   - `/api/AnnualFees` (admin list) — uses **PascalCase** keys.
 *   - `/api/AnnualFees/active` and `/api/AnnualFees/my-purchases` —
 *     use **camelCase** keys. Centralised handling per function below.
 *   - `/api/AnnualFees/admin/subscriptions` (new) — uses **PascalCase**
 *     query keys (`Page`, `PageSize`, `Search`, `Role`, `Status`).
 *
 * The legacy `/api/AnnualFee` (singular) controller was dropped by the BE.
 */
import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  ActiveAnnualFeeListParams,
  AdminUserSubscription,
  AdminUserSubscriptionListParams,
  AdminUserSubscriptionListResult,
  AnnualFee,
  AnnualFeeListParams,
  AnnualFeePurchase,
  AnnualFeePurchaseRequest,
  AnnualFeePurchaseResponse,
  AnnualFeeSubscriber,
  AnnualFeeSubscriberListParams,
  AnnualFeeSubscriberListResult,
  AnnualFeeToggleRequest,
  AnnualFeeUpsertRequest,
  CurrentAnnualFeeSubscription,
  PagedResult,
  PurchaseHistoryParams,
} from '../types/annualFee';

const ENDPOINTS = API_ENDPOINTS.ADMIN.ANNUAL_FEES;

interface RawPagedResult<T> {
  items?: T[];
  data?: T[];
  Items?: T[];
  Data?: T[];
  total?: number;
  Total?: number;
  page?: number;
  Page?: number;
  pageSize?: number;
  PageSize?: number;
}

/**
 * Defensive paged-result normaliser — accepts either camelCase or PascalCase
 * shapes from the BE so we tolerate either casing in the wire payload.
 */
const normalisePaged = <T>(raw: RawPagedResult<T> | null | undefined): PagedResult<T> => {
  const items = raw?.items ?? raw?.data ?? raw?.Items ?? raw?.Data ?? [];
  const total = raw?.total ?? raw?.Total ?? items.length;
  const page = raw?.page ?? raw?.Page ?? 1;
  const pageSize = raw?.pageSize ?? raw?.PageSize ?? items.length;
  return { items, total, page, pageSize };
};

// ── Public fee plans (for subscription UI) ─────────────────────────────

/**
 * Fetch all annual fee plans available for purchase.
 * Used by the subscription page to show available plans.
 *
 * @param params.pagination Optional pagination params. The BE filters server-side.
 *
 * Wire format — the BE contract (`GET /api/AnnualFees`) uses **PascalCase**
 * query keys (`PageNumber`, `PageSize`, `Search`, `UserRole`,
 * `BillingCycle`, `Status`, `SortBy`, `SortDir`). Sending the camelCase
 * versions the BE rejects with `400 Bad Request`. Note the inconsistency
 * with `/api/AnnualFees/active` and `/api/AnnualFees/my-purchases`, which
 * still use camelCase (`page`, `pageSize`) — those are intentionally
 * untouched.
 *
 * The `Status` parameter is a `boolean`, not a string. The FE-side
 * `'ALL' | 'ACTIVE' | 'INACTIVE'` filter is mapped here to either
 * `true` / `false` / omitted so the BE never receives a non-boolean value.
 *
 * Empty `Search`, `UserRole`, `BillingCycle` values are dropped entirely
 * rather than sent as empty strings.
 */
export const listAnnualFeePlans = async (
  params?: AnnualFeeListParams,
): Promise<PagedResult<AnnualFee>> => {
  const out: Record<string, string | number | boolean> = {
    PageNumber: params?.page ?? 1,
    PageSize: params?.pageSize ?? 20,
    SortBy: params?.sortBy ?? 'Price',
    SortDir: params?.sortDir ?? 'asc',
  };

  const search = (params?.search ?? '').trim();
  if (search) out.Search = search;
  if (params?.userRole) out.UserRole = params.userRole;
  if (params?.billingCycle) out.BillingCycle = params.billingCycle;

  // Map the FE tri-state filter onto the BE's boolean Status parameter.
  // `ALL` → omit entirely (server returns both states).
  // `ACTIVE` / `INACTIVE` → boolean.
  if (params?.status === 'ACTIVE') out.Status = true;
  else if (params?.status === 'INACTIVE') out.Status = false;

  const response = await api.get<RawPagedResult<AnnualFee>>(ENDPOINTS.GET_ALL, {
    params: out,
  });
  return normalisePaged(response.data);
};

/**
 * Fetch active annual fee plans visible to the current user.
 * The BE filters by JWT role, so the user only sees plans they can buy.
 */
export const listActiveAnnualFeePlans = async (
  params?: ActiveAnnualFeeListParams,
): Promise<PagedResult<AnnualFee>> => {
  const response = await api.get<RawPagedResult<AnnualFee>>(ENDPOINTS.GET_ACTIVE, {
    params: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    },
  });
  return normalisePaged(response.data);
};

/**
 * Fetch a single annual fee plan by ID.
 */
export const getAnnualFeePlan = async (id: number): Promise<AnnualFee> => {
  const response = await api.get<AnnualFee>(ENDPOINTS.GET_BY_ID(id));
  return response.data;
};

// ── Admin fee plan management ────────────────────────────────────────

/**
 * Admin: Create a new annual fee plan.
 */
export const createAnnualFeePlan = async (
  data: AnnualFeeUpsertRequest,
): Promise<AnnualFee> => {
  const response = await api.post<AnnualFee>(ENDPOINTS.CREATE, data);
  return response.data;
};

/**
 * Admin: Update an existing annual fee plan.
 */
export const updateAnnualFeePlan = async (
  id: number,
  data: AnnualFeeUpsertRequest,
): Promise<AnnualFee> => {
  const response = await api.put<AnnualFee>(ENDPOINTS.UPDATE(id), data);
  return response.data;
};

/**
 * Admin: Delete an annual fee plan.
 * BE refuses with 409 if any purchase references this plan.
 */
export const deleteAnnualFeePlan = async (id: number): Promise<void> => {
  await api.delete(ENDPOINTS.DELETE(id));
};

/**
 * Admin: Toggle whether a fee plan is active (accepting new purchases).
 */
export const toggleAnnualFeePlan = async (
  id: number,
  status: boolean,
): Promise<AnnualFee> => {
  const body: AnnualFeeToggleRequest = { status };
  const response = await api.patch<AnnualFee>(ENDPOINTS.TOGGLE(id), body);
  return response.data;
};

// ── User purchase flow ─────────────────────────────────────────────

/**
 * Initiate a purchase for an annual fee plan.
 * Returns a PayOS checkout URL to redirect the user.
 */
export const purchaseAnnualFee = async (
  annualFeeId: number,
  request: AnnualFeePurchaseRequest = {},
): Promise<AnnualFeePurchaseResponse> => {
  const response = await api.post<AnnualFeePurchaseResponse>(
    ENDPOINTS.PURCHASE(annualFeeId),
    request,
  );
  return response.data;
};

/**
 * Get the user's current active annual fee subscription.
 * Returns null if the user has no active subscription.
 *
 * Powers both the header profile badge and the Subscription tab.
 */
export const getMyCurrentSubscription = async (): Promise<CurrentAnnualFeeSubscription | null> => {
  let data: any = null;
  try {
    const response = await api.get<any>(ENDPOINTS.MY_SUBSCRIPTION);
    data = response.data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        const fallbackRes = await api.get<any>('/api/annual-fees/my-current-subscription');
        data = fallbackRes.data;
      } catch {
        return null;
      }
    } else {
      throw err;
    }
  }

  if (!data || typeof data !== 'object') return null;

  // The BE returns `{ message: "No active subscription." }` (HTTP 200) when
  // the user has no active subscription. Normalise this to `null`.
  if (
    'message' in data &&
    !('purchase' in data && data.purchase != null) &&
    !('annualFee' in data && data.annualFee != null) &&
    !('isExpired' in data) &&
    !('daysRemaining' in data) &&
    !('expiresAt' in data)
  ) {
    return null;
  }

  // Extract authoritative expired flag & daysRemaining
  const isExplicitlyExpired = Boolean(data.isExpired);
  const daysRemaining = typeof data.daysRemaining === 'number' ? data.daysRemaining : 0;
  const isExpired = isExplicitlyExpired || (typeof data.daysRemaining === 'number' && data.daysRemaining <= 0);

  // Derive or preserve expiresAt
  let expiresAt = data.expiresAt ?? data.purchase?.expiryDate ?? null;
  if (!expiresAt && daysRemaining > 0) {
    expiresAt = new Date(Date.now() + daysRemaining * 86400000).toISOString();
  }

  // Normalize annualFee plan object
  const annualFee = data.annualFee ?? {
    id: data.purchase?.annualFeeId ?? 0,
    name: daysRemaining > 0 ? `${daysRemaining}-Day Subscription` : 'Active Subscription',
    userRole: 'Researcher',
    price: data.purchase?.amount ?? 0,
    billingCycle: 'Annual',
    status: true,
  };

  return {
    purchase: data.purchase ?? null,
    annualFee,
    daysRemaining,
    isExpired,
    expiresAt,
  };
};

/**
 * Admin-side: fetch the current subscription for an arbitrary user.
 *
 * Primary path (new — 2026): the BE shipped
 *   `GET /api/AnnualFees/admin/subscriptions?Search=&Role=&Status=`
 * which returns a paged snapshot of every user's subscription.
 *
 * The endpoint's `Search` parameter is a free-text needle matched by
 * the BE against `fullName` / `email` — it does NOT match `userId`.
 * So a naive `Search=<userId>` returns no rows, which is exactly the
 * bug this function previously hit (modal kept falling back to
 * `my-subscription`, which is scoped to the caller's JWT, so admins
 * saw "No active subscription" for every target user).
 *
 * To get a deterministic match we feed the BE the target user's
 * `email` first (highly unique) and fall back to `fullName`. The
 * page is then narrowed down to that single row using `Role` (also
 * passed in by the caller) and `Status` is left blank so both Active
 * and Expired rows can be found. We then re-verify `userId` against
 * the returned row before trusting any of its fields.
 *
 * Fallback path (kept for backward compatibility): if the admin
 * endpoint is not yet reachable on a deploy (e.g. mid-rollout), we
 * still try `GET /api/AnnualFees/my-subscription?userId={id}` — this
 * used to be the only way admins could see a user's expiry. The BE
 * may either honour the parameter (and return the target user's
 * record) or return `{ message: "No active subscription." }` for the
 * admin caller. Either outcome is non-throwing.
 *
 * The function always returns a `CurrentAnnualFeeSubscription | null`
 * so the parent modal never surfaces an error card for this row.
 * A `null` return means "we could not find any subscription record for
 * this user" and the modal renders an "Unavailable" hint.
 */
export interface UserSubscriptionLookup {
  /** DB id of the target user — used for re-verifying the matched row. */
  userId: number;
  /** User email — preferred `Search` needle (most unique). Optional but recommended. */
  email?: string | null;
  /** User display name — fallback `Search` needle. */
  fullName?: string | null;
  /**
   * User role string as surfaced by the BE on `AdminUserSubscription.userRole`
   * — used as the `Role` query filter so the page narrows to the target
   * user without scanning unrelated rows. Optional.
   */
  userRole?: string | null;
}

export const getUserCurrentSubscription = async (
  lookup: UserSubscriptionLookup | number,
): Promise<CurrentAnnualFeeSubscription | null> => {
  // Back-compat: callers that still pass a bare number get the legacy
  // behaviour (search by userId as text, no role filter). New code
  // should pass the full object.
  const args: UserSubscriptionLookup =
    typeof lookup === 'number' ? { userId: lookup } : lookup;
  const { userId, email, fullName, userRole } = args;

  // Pick the strongest identifier we have. Email is highly unique
  // across the platform; fullName is the BE's `Search` field but can
  // collide for common names — so we still verify the matched row's
  // `userId` before trusting any of its fields.
  const searchNeedle = (email && email.trim()) || (fullName && fullName.trim()) || '';
  const hasNeedle = searchNeedle.length > 0;

  // ── Primary path: new admin snapshot endpoint ─────────────────────
  try {
    const response = await api.get<{
      items?: AdminUserSubscription[];
      totalCount?: number;
      pageNumber?: number;
      pageSize?: number;
    }>(ENDPOINTS.ADMIN_SUBSCRIPTIONS, {
      params: {
        Page: 1,
        PageSize: 50,
        // Only attach `Search` when we have something meaningful —
        // sending an empty string can cause the BE to either ignore
        // the param or return every row, depending on its parser.
        ...(hasNeedle ? { Search: searchNeedle } : {}),
        // Attach the role filter whenever the caller passed one. This
        // narrows the page dramatically when the user has a common
        // name like "Nguyen Van A" and there are dozens of matches.
        ...(userRole ? { Role: userRole } : {}),
      },
    });
    const raw = response.data ?? {};
    const items = raw.items ?? [];

    // Re-verify the row by `userId` — never trust the search alone,
    // since the BE's free-text match can return a different user
    // with a similar name. Fall back to the first row ONLY when the
    // caller has no email/fullName and we're matching purely on
    // userId-as-text (which the BE doesn't really support, but we
    // keep the legacy behaviour here).
    // Explicit type: `Array.find()` returns `T | undefined` and
    // `items[0]` is `T | undefined` when the array is empty, so the
    // union is `AdminUserSubscription | undefined`. We coerce the
    // `undefined` case to `null` so the rest of the function can
    // treat the sentinel as a single, well-defined value.
    let match: AdminUserSubscription | null | undefined =
      items.find((row) => row?.userId === userId) ??
      (hasNeedle
        ? null
        : (items.find((row) => row?.userId === userId) ?? items[0])) ??
      null;

    // If we had no needle and the first row isn't ours, scan the
    // remaining pages so we don't accidentally pick someone else's
    // subscription.
    if (!match && !hasNeedle) {
      const totalPages =
        typeof raw.totalCount === 'number' && raw.pageSize
          ? Math.ceil(raw.totalCount / raw.pageSize)
          : 1;
      for (let page = 2; page <= Math.min(totalPages, 20); page += 1) {
        const next = await api.get<{
          items?: AdminUserSubscription[];
        }>(ENDPOINTS.ADMIN_SUBSCRIPTIONS, {
          params: { Page: page, PageSize: 50 },
        });
        const nextItems = next.data?.items ?? [];
        match = nextItems.find((row) => row?.userId === userId) ?? null;
        if (match) break;
      }
    }

    if (match && match.userId === userId) {
      const daysRemaining = typeof match.daysRemaining === 'number' ? match.daysRemaining : 0;
      const statusLooksExpired =
        typeof match.subscriptionStatus === 'string' &&
        /expired|inactive|expire/i.test(match.subscriptionStatus);
      const isExpired = statusLooksExpired || daysRemaining <= 0;

      // Trust the BE's `expiresAt` first; fall back to a client-side
      // computation from `daysRemaining` only when the BE omitted the
      // timestamp (very rare — the AdminUserSubscriptionResponse schema
      // marks it nullable but typically populated).
      let expiresAt: string | null = match.expiresAt ?? null;
      if (!expiresAt && daysRemaining > 0) {
        expiresAt = new Date(Date.now() + daysRemaining * 86400000).toISOString();
      }

      return {
        purchase: null,
        annualFee: match.annualFee,
        daysRemaining,
        isExpired,
        expiresAt,
      };
    }
    // If the new endpoint returned no match for this user, fall
    // through to the legacy path so we still try `my-subscription`.
  } catch {
    // Network / 404 / 500 on the new endpoint — fall through to legacy.
  }

  // ── Legacy fallback: `my-subscription?userId={id}` ─────────────────
  let data: any = null;
  try {
    // Attempt the admin-aware variant: `?userId={id}`. If the BE
    // honours it, this is the canonical lookup. If it ignores the
    // parameter, we still get a structured response (either the
    // admin's own subscription or a `{ message }` no-data payload).
    const response = await api.get<any>(ENDPOINTS.MY_SUBSCRIPTION, {
      params: { userId },
    });
    data = response.data;
  } catch {
    return null;
  }

  if (!data || typeof data !== 'object') return null;

  // If the BE returned only a `{ message }` payload (i.e. the admin
  // override is unsupported), bail out cleanly so the modal can show
  // an "Unavailable" hint rather than a misleading Expired state.
  if (
    'message' in data &&
    !('purchase' in data && data.purchase != null) &&
    !('annualFee' in data && data.annualFee != null) &&
    !('isExpired' in data) &&
    !('daysRemaining' in data) &&
    !('expiresAt' in data)
  ) {
    return null;
  }

  const isExplicitlyExpired = Boolean(data.isExpired);
  const daysRemaining = typeof data.daysRemaining === 'number' ? data.daysRemaining : 0;
  const isExpired = isExplicitlyExpired || (typeof data.daysRemaining === 'number' && daysRemaining <= 0);

  let expiresAt = data.expiresAt ?? data.purchase?.expiryDate ?? null;
  if (!expiresAt && daysRemaining > 0) {
    expiresAt = new Date(Date.now() + daysRemaining * 86400000).toISOString();
  }

  const annualFee = data.annualFee ?? {
    id: data.purchase?.annualFeeId ?? 0,
    name: daysRemaining > 0 ? `${daysRemaining}-Day Subscription` : 'Active Subscription',
    userRole: 'Researcher',
    price: data.purchase?.amount ?? 0,
    billingCycle: 'Annual',
    status: true,
  };

  return {
    purchase: data.purchase ?? null,
    annualFee,
    daysRemaining,
    isExpired,
    expiresAt,
  };
};

// ── Admin: subscription overview (paged) ─────────────────────────────

/**
 * Admin: paged snapshot of every user's subscription.
 *
 * Endpoint: `GET /api/AnnualFees/admin/subscriptions`
 *
 * Query params (PascalCase per BE admin route convention):
 *   - `Page`      — 1-based page number, default 1
 *   - `PageSize`  — page size, default 20
 *   - `Search`    — free-text needle matched against user name / email
 *   - `Role`      — role filter (e.g. `Researcher` | `Lecturer`)
 *   - `Status`    — status filter (e.g. `Active` | `Expired`)
 *
 * Response shape: `AdminUserSubscriptionResponsePagedResult`
 * (items[], totalCount, pageNumber, pageSize, totalPages, hasPrevious, hasNext)
 *
 * Powers the "Subscription status" column on `/admin/accounts` and
 * the View Profile modal so admins can see exactly when each user's
 * annual plan expires.
 */
export const listAdminUserSubscriptions = async (
  params?: AdminUserSubscriptionListParams,
): Promise<AdminUserSubscriptionListResult> => {
  const response = await api.get<{
    items?: AdminUserSubscription[];
    totalCount?: number;
    pageNumber?: number;
    pageSize?: number;
  }>(ENDPOINTS.ADMIN_SUBSCRIPTIONS, {
    params: {
      Page: params?.page ?? 1,
      PageSize: params?.pageSize ?? 20,
      Search: params?.search,
      Role: params?.role || undefined,
      Status: params?.status,
    },
  });
  const raw = response.data ?? {};
  const items = raw.items ?? [];
  return {
    items,
    total: raw.totalCount ?? items.length,
    page: raw.pageNumber ?? 1,
    pageSize: raw.pageSize ?? items.length,
  };
};

/**
 * Get the user's annual fee purchase history.
 */
export const getMyPurchaseHistory = async (
  params?: PurchaseHistoryParams,
): Promise<PagedResult<AnnualFeePurchase>> => {
  const response = await api.get<RawPagedResult<AnnualFeePurchase>>(
    ENDPOINTS.MY_PURCHASES,
    {
      params: {
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 10,
      },
    },
  );
  return normalisePaged(response.data);
};

// ── Admin: subscribers of a single plan ──────────────────────────────

/**
 * Admin: list every user currently subscribed to a given annual fee plan.
 *
 * Endpoint: `GET /api/AnnualFees/{planId}/subscribers`
 *
 * Query params (all camelCase per BE convention):
 *   - `page`     — page number, default 1
 *   - `pageSize` — page size, default 10
 *
 * Response shape: `AnnualFeeSubscriberResponsePagedResult`
 * (totalCount, pageNumber, pageSize, items[])
 */
export const listAnnualFeePlanSubscribers = async (
  planId: number,
  params?: AnnualFeeSubscriberListParams,
): Promise<AnnualFeeSubscriberListResult> => {
  const response = await api.get<{
    items?: AnnualFeeSubscriber[];
    totalCount?: number;
    pageNumber?: number;
    pageSize?: number;
  }>(ENDPOINTS.SUBSCRIBERS(planId), {
    params: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    },
  });
  const raw = response.data ?? {};
  const items = raw.items ?? [];
  return {
    items,
    total: raw.totalCount ?? items.length,
    page: raw.pageNumber ?? 1,
    pageSize: raw.pageSize ?? 10,
  };
};

// ── Service barrel export ────────────────────────────────────────────

export const annualFeeService = {
  listAnnualFeePlans,
  listActiveAnnualFeePlans,
  getAnnualFeePlan,
  createAnnualFeePlan,
  updateAnnualFeePlan,
  deleteAnnualFeePlan,
  toggleAnnualFeePlan,
  purchaseAnnualFee,
  getMyCurrentSubscription,
  getMyPurchaseHistory,
  listAnnualFeePlanSubscribers,
  listAdminUserSubscriptions,
};

export default annualFeeService;

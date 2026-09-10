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
 *
 * Note the inconsistent parameter casing between endpoints:
 *   - `/api/AnnualFees` (admin list) — uses **PascalCase** keys.
 *   - `/api/AnnualFees/active` and `/api/AnnualFees/my-purchases` —
 *     use **camelCase** keys. Centralised handling per function below.
 *
 * The legacy `/api/AnnualFee` (singular) controller was dropped by the BE.
 */
import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  ActiveAnnualFeeListParams,
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
  const response = await api.get<CurrentAnnualFeeSubscription | { message: string }>(
    ENDPOINTS.MY_SUBSCRIPTION,
  );
  // The BE returns `{ message: "No active subscription." }` (HTTP 200) when
  // the user has no active subscription. Normalise this to `null`.
  const data = response.data;
  if (data === null) return null;
  if ('message' in data && !('purchase' in data)) {
    return null;
  }
  return data as CurrentAnnualFeeSubscription;
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
};

export default annualFeeService;

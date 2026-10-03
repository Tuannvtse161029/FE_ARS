/**
 * Transaction service.
 *
 * Wraps the BE `/api/Transaction` controller. The admin Transactions
 * page is the only consumer; it needs:
 *
 *   - `listTransactionsPaged` — paged list for the admin table
 *   - `getTransactionById`     — single-record detail (reserved for a
 *                                future modal; not used by the list view)
 *
 * The legacy `/api/Transaction` (un-paginated) endpoint is intentionally
 * NOT exposed — admins should never pull the entire audit log in one
 * shot. See `services/adminUser.service.ts` for the same pattern.
 *
 * Endpoints follow the BE-published contract (Swagger § Transaction):
 *   GET    /api/Transaction/paged?PageNumber=&PageSize=&Search=
 *   GET    /api/Transaction/{id}
 *
 * Note the **PascalCase** query keys (`PageNumber`, `PageSize`, `Search`)
 * on the paged list — same convention as `/api/AnnualFees`,
 * `/api/AuditLog`, and the other admin controllers.
 */
import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  TransactionListParams,
  TransactionPagedResult,
  TransactionResponse,
} from '../types/transaction';
import type {
  AnalyticsRange,
  AnalyticsTimeSeries,
  AnalyticsTimeSeriesPoint,
} from '../types/admin';

interface RawTransactionPagedResult {
  items?: TransactionResponse[] | null;
  data?: TransactionResponse[] | null;
  Items?: TransactionResponse[] | null;
  Data?: TransactionResponse[] | null;
  totalCount?: number;
  TotalCount?: number;
  pageNumber?: number;
  PageNumber?: number;
  pageSize?: number;
  PageSize?: number;
  totalPages?: number;
  TotalPages?: number;
  hasPrevious?: boolean;
  HasPrevious?: boolean;
  hasNext?: boolean;
  HasNext?: boolean;
}

/**
 * Defensive normaliser for the paged result — accepts either camelCase
 * or PascalCase casing in the wire payload so we tolerate either side's
 * serialisation convention.
 */
const normalisePaged = (
  raw: RawTransactionPagedResult | null | undefined,
): TransactionPagedResult => {
  const items = raw?.items ?? raw?.data ?? raw?.Items ?? raw?.Data ?? [];
  const totalCount = raw?.totalCount ?? raw?.TotalCount ?? items.length;
  const pageNumber = raw?.pageNumber ?? raw?.PageNumber ?? 1;
  const pageSize = raw?.pageSize ?? raw?.PageSize ?? items.length;
  const totalPages = raw?.totalPages ?? raw?.TotalPages ?? 1;
  const hasPrevious = Boolean(raw?.hasPrevious ?? raw?.HasPrevious ?? false);
  const hasNext = Boolean(raw?.hasNext ?? raw?.HasNext ?? false);
  return {
    items,
    totalCount,
    pageNumber,
    pageSize,
    totalPages,
    hasPrevious,
    hasNext,
  };
};

/**
 * Admin: paged list of every ARS transaction (subscription payments,
 * wallet topups, withdrawals, reviewer payouts, etc.).
 *
 * The BE does NOT support a `userId` filter on this endpoint — admins
 * that want to drill into a specific user's transactions should pass
 * the user's email / name into `Search`, or filter the result client-side
 * via `TransactionResponse.userId`.
 */
export const listTransactionsPaged = async (
  params?: TransactionListParams,
): Promise<TransactionPagedResult> => {
  const out: Record<string, string | number> = {
    PageNumber: params?.page ?? 1,
    PageSize: params?.pageSize ?? 20,
  };
  const search = (params?.search ?? '').trim();
  if (search) out.Search = search;

  const response = await api.get<RawTransactionPagedResult>(
    API_ENDPOINTS.ADMIN.TRANSACTIONS.GET_PAGED,
    { params: out },
  );
  return normalisePaged(response.data);
};

/**
 * Admin: fetch a single transaction by id. Reserved for the future
 * detail modal; the list view does not call it.
 */
export const getTransactionById = async (
  id: number,
): Promise<TransactionResponse> => {
  const response = await api.get<TransactionResponse>(
    API_ENDPOINTS.ADMIN.TRANSACTIONS.GET_BY_ID(id),
  );
  return response.data;
};

/**
 * Statuses that count as "realised revenue" for the admin dashboard.
 * Anything else (Pending, Pending_Payment, Failed, Cancelled, Expired,
 * Refunded, Rejected, Denied) is excluded so the chart never shows
 * un-paid or reversed money as income. Comparison is case-insensitive
 * and tolerant of underscores / hyphens so it survives BE naming
 * drift (e.g. "Pending_Payment" vs "pending-payment").
 */
const REVENUE_STATUS_ALLOWLIST = new Set(
  ['paid', 'active', 'completed', 'succeeded'].map((s) => s.toLowerCase()),
);

const isRevenueStatus = (status: string | null | undefined): boolean => {
  if (!status) return false;
  const normalized = status.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return REVENUE_STATUS_ALLOWLIST.has(normalized);
};

/**
 * Bin key for a given transaction date + range. Kept as an ISO-ish
 * string so the chart's `formatChartDate` (which expects a parseable
 * date) can render it without surprises.
 *   - daily   → 'YYYY-MM-DD'
 *   - weekly  → 'YYYY-MM-DD' of the ISO week start (Monday)
 *   - monthly → 'YYYY-MM'
 *   - yearly  → 'YYYY'
 */
const binKey = (iso: string, range: AnalyticsRange): string | null => {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (range === 'yearly') return String(y);
  if (range === 'monthly') return `${y}-${m}`;
  if (range === 'weekly') {
    // Move to the Monday of the same ISO week so bins are stable
    // across the admin's timezone.
    const dayOfWeek = d.getUTCDay() || 7; // Sun=0 → treat as 7
    const monday = new Date(ts - (dayOfWeek - 1) * 86400000);
    const wy = monday.getUTCFullYear();
    const wm = String(monday.getUTCMonth() + 1).padStart(2, '0');
    const wd = String(monday.getUTCDate()).padStart(2, '0');
    return `${wy}-${wm}-${wd}`;
  }
  return `${y}-${m}-${day}`;
};

/**
 * Admin dashboard: revenue time-series derived from the live
 * `/api/Transaction/paged` endpoint.
 *
 * The BE's `/api/Analytics/timeseries?metric=revenue` endpoint either
 * returns no data or returns data the admin can't reconcile against
 * the audit log. To make the dashboard honest, we pull real
 * transactions, sum `amount` per bin, and return them in the same
 * `AnalyticsTimeSeries` shape the chart already consumes.
 *
 * Only statuses in `REVENUE_STATUS_ALLOWLIST` count toward revenue —
 * Pending, Failed, Cancelled, Refunded, Expired, etc. are excluded.
 *
 * Safety: caps the total number of pages we walk (40 × 500 = 20k rows)
 * so a runaway DB can't pin the FE. For a project of this scale (low
 * thousands of transactions per year) that ceiling is generous.
 */
export const getRevenueTimeseriesFromTransactions = async (
  range: AnalyticsRange,
  signal?: AbortSignal,
): Promise<AnalyticsTimeSeries> => {
  const PAGE_SIZE = 500;
  const MAX_PAGES = 40;

  const buckets = new Map<string, number>();
  let page = 1;
  let totalPages = 1;
  let pagesFetched = 0;

  while (page <= totalPages && pagesFetched < MAX_PAGES) {
    if (signal?.aborted) break;
    const result = await listTransactionsPaged({ page, pageSize: PAGE_SIZE });
    pagesFetched += 1;
    totalPages = Math.max(1, result.totalPages);

    for (const tx of result.items) {
      if (!isRevenueStatus(tx.status)) continue;
      if (tx.amount == null) continue;
      if (!tx.createdAt) continue;
      const key = binKey(tx.createdAt, range);
      if (!key) continue;
      buckets.set(key, (buckets.get(key) ?? 0) + tx.amount);
    }

    if (!result.hasNext) break;
    page += 1;
  }

  const points: AnalyticsTimeSeriesPoint[] = Array.from(buckets.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { range, metric: 'revenue', points };
};

export const transactionService = {
  listTransactionsPaged,
  getTransactionById,
  getRevenueTimeseriesFromTransactions,
};

export default transactionService;

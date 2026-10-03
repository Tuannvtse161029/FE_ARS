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

export const transactionService = {
  listTransactionsPaged,
  getTransactionById,
};

export default transactionService;

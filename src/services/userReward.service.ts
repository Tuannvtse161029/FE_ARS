/**
 * User Reward service.
 *
 * Handles admin CRUD + the internal `/match` helper used by the publish
 * flow. All endpoints mirror the BE Swagger contract published at
 * https://arsplatform.onrender.com/swagger/index.html#/UserReward.
 *
 *   GET    /api/UserReward
 *   POST   /api/UserReward
 *   GET    /api/UserReward/paged?PageNumber=&PageSize=&Status=&Search=
 *   GET    /api/UserReward/{id}
 *   PUT    /api/UserReward/{id}
 *   DELETE /api/UserReward/{id}
 *   PATCH  /api/UserReward/{id}/status
 *   POST   /api/UserReward/match   { name }
 *
 * The paged list uses PascalCase query keys (PageNumber, PageSize, Status,
 * Search) — the same convention used by `/api/AnnualFees`. The un-paginated
 * `/api/UserReward` and the by-id endpoints take no body.
 *
 * NOTE on casing inconsistency: the BE may return either PascalCase or
 * camelCase fields for some entities. For UserReward we keep the wire
 * shape strict (lowercase first letter) because every Swagger example
 * already follows that convention.
 */
import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type {
  PagedResult,
  StatusUpdateBody,
  MatchRewardRequest,
  UserReward,
  UserRewardCreateRequest,
  UserRewardListParams,
  UserRewardUpdateRequest,
} from '../types/userReward';

const ENDPOINTS = API_ENDPOINTS.ADMIN.USER_REWARD;

interface RawPagedResult<T> {
  items?: T[];
  data?: T[];
  Items?: T[];
  Data?: T[];
  total?: number;
  totalCount?: number;
  Total?: number;
  page?: number;
  pageNumber?: number;
  PageNumber?: number;
  pageSize?: number;
  pageSize2?: number;
  PageSize?: number;
}

/**
 * Defensive paged-result normaliser — accepts either camelCase or
 * PascalCase shapes from the BE so we tolerate either casing in the
 * wire payload without crashing the admin page.
 */
const normalisePaged = <T>(
  raw: RawPagedResult<T> | null | undefined,
): PagedResult<T> => {
  const items = (raw?.items ??
    raw?.data ??
    raw?.Items ??
    raw?.Data ??
    []) as T[];
  const total =
    raw?.total ?? raw?.totalCount ?? raw?.Total ?? items.length;
  const page = raw?.page ?? raw?.pageNumber ?? raw?.PageNumber ?? 1;
  const pageSize =
    raw?.pageSize ?? raw?.pageSize2 ?? raw?.PageSize ?? items.length;
  return { items, total, page, pageSize };
};

/**
 * Admin: list every reward (no pagination).
 */
export const listAllUserRewards = async (): Promise<UserReward[]> => {
  const response = await api.get<UserReward[] | RawPagedResult<UserReward>>(
    ENDPOINTS.GET_ALL,
  );
  const data = response.data;
  if (Array.isArray(data)) return data;
  return normalisePaged(data as RawPagedResult<UserReward>).items;
};

/**
 * Admin: list rewards with pagination + filter.
 *
 * The BE accepts PascalCase query keys:
 *   PageNumber, PageSize, Status, Search
 * Empty `Search` and `status === 'ALL'` are dropped so the BE never
 * sees an empty string it might 400 on.
 */
export const listUserRewardsPaged = async (
  params?: UserRewardListParams,
): Promise<PagedResult<UserReward>> => {
  const out: Record<string, string | number> = {
    PageNumber: params?.page ?? 1,
    PageSize: params?.pageSize ?? 20,
  };
  const search = (params?.search ?? '').trim();
  if (search) out.Search = search;
  if (params?.status && params.status !== 'ALL') out.Status = params.status;

  const response = await api.get<RawPagedResult<UserReward>>(
    ENDPOINTS.GET_PAGED,
    { params: out },
  );
  return normalisePaged(response.data);
};

/**
 * Admin: get a single reward by id.
 */
export const getUserReward = async (id: number): Promise<UserReward> => {
  const response = await api.get<UserReward>(ENDPOINTS.GET_BY_ID(id));
  return response.data;
};

/**
 * Admin: create a new reward.
 */
export const createUserReward = async (
  data: UserRewardCreateRequest,
): Promise<UserReward> => {
  const response = await api.post<UserReward>(ENDPOINTS.CREATE, data);
  return response.data;
};

/**
 * Admin: update a reward. Partial update via PUT is allowed by the BE
 * for the documented Swagger schema (every field optional on Update).
 */
export const updateUserReward = async (
  id: number,
  data: UserRewardUpdateRequest,
): Promise<UserReward> => {
  const response = await api.put<UserReward>(ENDPOINTS.UPDATE(id), data);
  return response.data;
};

/**
 * Admin: delete a reward.
 */
export const deleteUserReward = async (id: number): Promise<void> => {
  await api.delete(ENDPOINTS.DELETE(id));
};

/**
 * Admin: fast-toggle status via PATCH. The BE accepts a string body
 * (`{ status: "Active" | "InActive" }`).
 */
export const patchUserRewardStatus = async (
  id: number,
  status: string,
): Promise<UserReward> => {
  const body: StatusUpdateBody = { status };
  const response = await api.patch<UserReward>(ENDPOINTS.PATCH_STATUS(id), body);
  return response.data;
};

/**
 * Internal / dev helper: auto-match an active reward by canonical name.
 * Returns the resolved reward row or `null` when no match is found.
 *
 * The BE response may arrive as either:
 *   - the raw UserReward object, or
 *   - an empty payload ({}) interpreted as no match.
 *
 * This wrapper normalises both shapes and additionally catches HTTP 404
 * so callers can rely on a `null` return rather than a thrown error.
 */
export const matchActiveReward = async (
  request: MatchRewardRequest,
): Promise<UserReward | null> => {
  try {
    const response = await api.post<UserReward | null | Record<string, unknown>>(
      ENDPOINTS.MATCH,
      request,
    );
    const body = response.data;
    if (!body || typeof body !== 'object') return null;
    // The BE occasionally returns `{}` for "not found" — guard on `id`.
    const candidate = body as Partial<UserReward>;
    if (
      typeof candidate.id !== 'number' &&
      typeof candidate.id !== 'string'
    ) {
      return null;
    }
    return candidate as UserReward;
  } catch (err: unknown) {
    const status =
      err &&
      typeof err === 'object' &&
      'response' in err &&
      (err as { response?: { status?: number } }).response?.status;
    if (status === 404 || status === 400) return null;
    // Re-throw so genuinely fatal failures (5xx, network) bubble up to
    // the publish flow's defensive try/catch.
    throw err;
  }
};

// ── Service barrel export ────────────────────────────────────────────

export const userRewardService = {
  listAllUserRewards,
  listUserRewardsPaged,
  getUserReward,
  createUserReward,
  updateUserReward,
  deleteUserReward,
  patchUserRewardStatus,
  matchActiveReward,
};

export default userRewardService;

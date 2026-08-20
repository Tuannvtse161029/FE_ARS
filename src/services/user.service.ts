import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';
import type { User, AccountTier } from '../types/auth';
import type { PagedResult, PaginationParams } from '../types/api';

// Wire-shape DTO. Mirrors `UserUpdateRequest` in `swagger.json:6161-6181`:
//   - fullName required (minLength 1)
//   - avatarUrl optional, nullable
//   - isActive optional, nullable
//
// IMPORTANT: This is a PUT in the contract (`/api/User/{id}` PUT at
// `swagger.json:3740-3779`), NOT a PATCH. The BE expects the full payload even
// when only flipping `isActive`. Callers MUST construct this object from the
// current authoritative User record — never merge an incomplete payload
// into the request, that risks overwriting unrelated fields with null.
export interface UserUpdateRequest {
  fullName: string;
  avatarUrl?: string | null;
  isActive?: boolean | null;
}

// DEFAULT_PAGE_SIZE on /api/User is small; Admin pages walk every page until
// the documented totalPages is reached (see Agent 29 BTR-AGENT29-A for
// server-side filtering). 50 keeps each round-trip cheap while staying well
// under any sensible BE row-count cap.
const DEFAULT_USER_PAGE_SIZE = 50;

// Hard ceiling so the temporary client-side aggregation (BTR-AGENT29-A)
// cannot loop forever on a runaway BE response.
const MAX_USER_FETCH_PAGES = 50;

/**
 * Strict User API helper. Owns the wire shape only — every Admin-facing
 * helper that needs to talk to /api/User should go through this service
 * so we have one place to fix when the BE contract drifts.
 *
 * Agent 29: do NOT add a fallback `mock` branch here. If the BE is
 * unavailable the page should render an honest error state, not a fake
 * dataset (BTR-AGENT29-A..D).
 */
export const userService = {
  getAll: async (params?: PaginationParams): Promise<PagedResult<User>> => {
    const response = await api.get<PagedResult<User>>(API_ENDPOINTS.USER.GET_ALL, { params });
    return response.data;
  },

  /**
   * Fetch a single backend page of users. Strict shape — the FE never
   * invents fields that Swagger does not publish.
   */
  getPaged: async (params: PaginationParams): Promise<PagedResult<User>> => {
    const response = await api.get<PagedResult<User>>(API_ENDPOINTS.USER.GET_ALL, { params });
    return response.data;
  },

  /**
   * Walk every backend page until totalPages is reached, returning the
   * concatenated `items` list. Used by Agent 40 / Agent 41 to apply a
   * client-side filter (verificationStatus / account-status) that the BE
   * has not yet published.
   *
   * Stops safely when:
   *   - the current page equals the documented `totalPages`
   *   - the returned page is empty
   *   - {@link MAX_USER_FETCH_PAGES} is reached (defensive ceiling)
   */
  getAllUsers: async (
    pageSize: number = DEFAULT_USER_PAGE_SIZE,
  ): Promise<{ items: User[]; totalCount: number; fetchedAt: string }> => {
    const first = await userService.getPaged({ pageNumber: 1, pageSize });
    const items: User[] = [...(first.items ?? [])];
    const totalCount = first.totalCount ?? items.length;
    const totalPages = first.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));

    for (let page = 2; page <= totalPages && page <= MAX_USER_FETCH_PAGES; page += 1) {
      const next = await userService.getPaged({ pageNumber: page, pageSize });
      if (!next.items?.length) break;
      items.push(...next.items);
      // totalPages can grow as the dataset changes; recompute defensively.
      const liveTotalPages =
        next.totalPages ?? Math.max(page, Math.ceil((next.totalCount ?? items.length) / pageSize));
      if (page >= liveTotalPages) break;
    }

    return { items, totalCount, fetchedAt: new Date().toISOString() };
  },

  getById: async (id: number): Promise<User> => {
    const response = await api.get<User>(API_ENDPOINTS.USER.GET_BY_ID(id));
    return response.data;
  },

  /**
   * Update a user. PUT semantics — call sites MUST construct the request
   * from the current authoritative User record (fullName required) and
   * overlay only the field they need to mutate. Passing a sparse body
   * risks overwriting unrelated fields.
   *
   * Helpers below (`updateIsActive`) are the only safe call sites for
   * single-field mutations; callers that need to edit `fullName` or
   * `avatarUrl` should construct a full {@link UserUpdateRequest} here
   * (or split this into a narrower PATCH when the BE grows one).
   */
  update: async (id: number, data: UserUpdateRequest): Promise<User> => {
    const response = await api.put<User>(API_ENDPOINTS.USER.UPDATE(id), data);
    return response.data;
  },

  /**
   * Suspend / unsuspend helper. Reads the current user first (so the FE
   * can construct a full PUT body without erasing fullName / avatarUrl),
   * then PATCHes only `isActive`. Server-confirmation only — no
   * optimistic flip on the FE side.
   */
  updateIsActive: async (id: number, isActive: boolean): Promise<User> => {
    const current = await userService.getById(id);
    const fullName = (current.fullName ?? '').trim();
    if (!fullName) {
      throw new Error(
        `Cannot suspend user #${id}: the BE record has no fullName. Fix the User API or seed the row before continuing.`,
      );
    }
    return userService.update(id, {
      fullName,
      avatarUrl: current.orcidId ?? current.username ?? null,
      isActive,
    });
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(API_ENDPOINTS.USER.DELETE(id));
  },
};

/**
 * Display normalization for `accountTier`. The DB column is nullable and
 * product rules say null = Free. Centralized here so the Admin accounts
 * column does not have to handle both spellings.
 */
export const displayAccountTier = (tier: AccountTier | null | undefined): AccountTier =>
  tier ?? 'Free';

export default userService;

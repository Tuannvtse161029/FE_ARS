/**
 * User Reward types.
 *
 * Mirrors the BE-published UserReward contract. The BE controllers are:
 *   /api/UserReward                  — GET (Admin, all), POST (Admin, create)
 *   /api/UserReward/paged            — GET (paginated + filter)
 *   /api/UserReward/{id}             — GET / PUT / DELETE (Admin)
 *   /api/UserReward/{id}/status      — PATCH (Quick toggle Active | InActive)
 *   /api/UserReward/match            — POST (internal / dev: auto-match by Name)
 *
 * Status is a string on the wire: "Active" | "InActive". The BE enforces
 * `status` length 0..20 on the request, so the FE treats it as a string
 * (not a boolean) to stay aligned with the contract.
 *
 * Field conventions follow the BE wire format exactly:
 *   - `id`, `name`, `description`, `rewardMonths`, `status`
 *   - `rewardMonths` is the months added to the user's annual subscription
 *     when the associated milestone is reached (e.g. paper published).
 */

export type UserRewardStatus = 'Active' | 'InActive';

/** Admin-managed reward config definition. */
export interface UserReward {
  id: number;
  /** Canonical slug used by the BE /match endpoint, e.g. "researcher-published-paper". */
  name: string;
  /** Human-friendly context copy. May be null/empty when the BE omits the field. */
  description?: string | null;
  /** Whole months to add to the user's annual subscription when rewarded. 1..1200. */
  rewardMonths: number;
  /** Wire status — "Active" or "InActive". The FE normalises to a boolean for views. */
  status: UserRewardStatus | string;
  /** ISO timestamps from the BE; absent for newly-created rows. */
  createdAt?: string;
  updatedAt?: string;
}

/** Admin create payload (BE-validated). `name` is required. */
export interface UserRewardCreateRequest {
  name: string;
  description?: string | null;
  rewardMonths: number;
  status?: UserRewardStatus | string | null;
}

/** Admin update payload (every field optional). */
export interface UserRewardUpdateRequest {
  name?: string | null;
  description?: string | null;
  rewardMonths?: number | null;
  status?: UserRewardStatus | string | null;
}

/** PATCH status body — quick-toggle endpoint. */
export interface StatusUpdateBody {
  status?: string | null;
}

/**
 * Internal / dev helper used by the publish flow to look up an active
 * reward by canonical name. The BE returns the resolved UserReward or
 * `null` when no active row matches.
 */
export interface MatchRewardRequest {
  name?: string | null;
}

/** Filter params for the paged list. PascalCase to match the BE contract. */
export interface UserRewardListParams {
  page?: number;
  pageSize?: number;
  status?: UserRewardStatus | 'ALL';
  search?: string;
}

/** Generic paged response wrapper. */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Helper: truthy when the row is "on" regardless of the wire casing. */
export const isActiveUserReward = (status: string | null | undefined): boolean =>
  typeof status === 'string' && status.toLowerCase() === 'active';

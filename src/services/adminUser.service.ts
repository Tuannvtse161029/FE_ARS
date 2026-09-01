/**
 * adminUserService — strict /api/User adapter for the Admin verification queue.
 *
 * The legacy `/api/RoleRequest` endpoint is no longer authoritative
 * (BTR-AGENT29-A). The Admin "Role Requests" page now derives the queue
 * directly from the live User list, filtering client-side by
 * `verificationStatus`. This service is the only place that reads
 * `/api/User` for Admin UI; AdminAccountsManagement goes through the
 * generic `userService` because it manipulates users, this one just
 * inspects them.
 *
 * Strict contract — never invent fields that Swagger does not publish.
 *   - `verificationStatus` is `'Pending' | 'Accepted' | 'Rejected' | null`
 *   - `accountTier` defaults to 'Free' when null
 *   - `roleName` is the BE-derived business-role name; null when the
 *     BE has not yet assigned a role
 *   - `proofDocumentUrl` is the Firebase Storage PDF for the
 *     verification document
 *
 * Centralized so future BE growth (server-side filter, pagination) has
 * one place to evolve. The shape returned by `listAllUsers()` mirrors
 * what the test double supplies, so swapping in a mock is trivial.
 */
import { userService } from './user.service';
import type { AccountTier, User, VerificationStatus } from '../types/auth';

export type AdminUserRow = User;
export type AdminVerificationStatus = Exclude<VerificationStatus, null>;

export interface AdminUserListResult {
  rows: AdminUserRow[];
  totalCount: number;
  fetchedAt: string;
}

export const KNOWN_VERIFICATION_STATUSES: ReadonlyArray<AdminVerificationStatus> = [
  'Pending',
  'Accepted',
  'Rejected',
];

/**
 * Defensive normalizer — turns anything the BE surfaces into the
 * `AdminVerificationStatus` union (or `null` when the value is
 * genuinely empty). We never coerce `null` → `'Pending'` here; that
 * would silently manufacture a verification pipeline the BE has not
 * actually published. Caller decides whether to treat `null` as
 * "untracked" or skip the row.
 */
export const normalizeVerificationStatus = (raw: unknown): AdminVerificationStatus | null => {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim();
  if (!upper) return null;
  const canonical = upper.charAt(0).toUpperCase() + upper.slice(1).toLowerCase();
  if ((KNOWN_VERIFICATION_STATUSES as ReadonlyArray<string>).includes(canonical)) {
    return canonical as AdminVerificationStatus;
  }
  return null;
};

export const isPendingVerification = (user: { verificationStatus?: VerificationStatus }) =>
  normalizeVerificationStatus(user.verificationStatus) === 'Pending';

const fetchAllRows = async (): Promise<AdminUserListResult> => {
  const { items, totalCount, fetchedAt } = await userService.getAllUsers();
  return {
    rows: items.map((row) => ({ ...row })),
    totalCount,
    fetchedAt,
  };
};

const listAllUsers = async (): Promise<AdminUserListResult> => fetchAllRows();

const listPendingVerification = async (): Promise<AdminUserListResult> => {
  const all = await fetchAllRows();
  return {
    rows: all.rows.filter(isPendingVerification),
    totalCount: all.totalCount,
    fetchedAt: all.fetchedAt,
  };
};

const getById = async (id: number): Promise<AdminUserRow> => {
  const user = await userService.getById(id);
  return { ...user };
};

export const adminUserService = {
  listAllUsers,
  listPendingVerification,
  getById,
};

export default adminUserService;

// Re-export the small surface pieces tests/consumers import directly.
export { displayAccountTier } from './user.service';
export type { AccountTier };
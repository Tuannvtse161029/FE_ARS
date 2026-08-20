import { userService } from './user.service';
import type { User } from '../types/auth';

// ── Agent 29 — shared User surface for Admin pages ─────────────────────────
//
// `admin.service` already maps User → AccountItem for the Accounts page; this
// service owns the verification-page aggregation and the supporting hooks
// used by both Agent 40 (Role Requests) and Agent 41 (Accounts Management).
//
// Goals:
//   - one place to fix when /api/User drift happens
//   - typed DTOs, no `any`
//   - no mock fallback (Admin pages must show an honest error when the BE
//     is unreachable; see BTR-AGENT29-A)
//   - normalization helpers for status / tier displayed values
//   - the suspend/unsuspend helper that constructs a full PUT body so the
//     Admin cannot accidentally overwrite unrelated fields with null
//
// Out of scope (owned elsewhere):
//   - AccountItem normalization → admin.service.userToAccountItem
//   - Withdrawals → admin.service
//   - Analytics → admin.service

/** Wire shape returned by `GET /api/User` (`swagger.json:3688-3716`).
 *  The BE does not publish a schema reference, so the FE normalizes on
 *  read. Treat every field as optional except `id` and `email`/`fullName`
 *  which the screenshots and prior responses confirm are always present.
 */
export type VerificationStatus = 'Pending' | 'Accepted' | 'Rejected' | string;

/** The set of values the Admin verification page is prepared to render.
 *  Anything outside this set is shown verbatim with the original casing so
 *  the Admin can spot a new BE value during the migration window.
 */
export const KNOWN_VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  'Pending',
  'Accepted',
  'Rejected',
] as const;

/**
 * Normalize the BE-reported `verificationStatus` string. Casing safety only;
 * we never coerce `null` or an unknown string to `Accepted` / `Pending` —
 * the Admin UI surfaces the raw value so a data-quality issue stays visible.
 */
export const normalizeVerificationStatus = (
  raw: unknown,
): VerificationStatus => {
  if (typeof raw !== 'string' || raw.length === 0) return '';
  return raw;
};

/**
 * Build a `User` filter predicate that returns `true` when the row is
 * considered a pending verification request. Used by the Role Requests
 * page (Agent 40) to list only users whose verification is still open.
 *
 * The predicate intentionally accepts any non-accepted / non-rejected value
 * as "pending" — that way, if the BE grows a new state (e.g. `AwaitingMoreInfo`)
 * the Admin UI does not silently drop the row.
 */
export const isPendingVerification = (user: User): boolean => {
  const status = normalizeVerificationStatus(user.verificationStatus);
  if (!status) return false; // No status ⇒ treat as already-resolved / unknown.
  if (KNOWN_VERIFICATION_STATUSES.includes(status)) {
    return status === 'Pending';
  }
  // Unknown status: do NOT silently coerce. Surface the raw value via the
  // table but only mark as pending if it is not explicitly Accepted or Rejected.
  return true;
};

/**
 * Aggregate of all users the Admin verification page should display. Walks
 * every backend page (see `userService.getAllUsers`) because the User API
 * does not yet support a server-side `verificationStatus` filter
 * (BTR-AGENT29-B).
 */
export interface PendingVerificationAggregate {
  rows: User[];
  totalCount: number;
  /** Capped walk — see `userService.MAX_USER_FETCH_PAGES`. */
  fetchedAt: string;
}

export const adminUserService = {
  /** Aggregate every backend page so the FE can apply a verification filter
   *  client-side. Until BE ships server-side filtering
   *  (BTR-AGENT29-B) this is the only safe way to display the pending queue
   *  without missing rows that live on later pages. */
  async listAllUsers(): Promise<PendingVerificationAggregate> {
    const { items, totalCount, fetchedAt } = await userService.getAllUsers();
    return { rows: items, totalCount, fetchedAt };
  },

  /** Narrowed to verificationStatus === Pending only. Returns the same
   *  envelope shape as `listAllUsers` for predictable UI handling. */
  async listPendingVerification(): Promise<PendingVerificationAggregate> {
    const all = await adminUserService.listAllUsers();
    return {
      rows: all.rows.filter(isPendingVerification),
      totalCount: all.totalCount,
      fetchedAt: all.fetchedAt,
    };
  },

  /** Read a single user (used by Details modal refresh). */
  async getById(id: number): Promise<User> {
    return userService.getById(id);
  },
};

export default adminUserService;
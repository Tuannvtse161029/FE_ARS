/**
 * Annual Fee types.
 *
 * Mirrors the BE-published AnnualFees contract. The BE controllers are:
 *   /api/AnnualFees/... (plural — note the trailing `s`)
 *
 * Core concepts:
 *   - AnnualFee: Admin-configured fee plans (price, billing cycle)
 *   - AnnualFeePurchase: User's purchase record with PayOS integration
 *
 * Field naming follows the BE wire format exactly:
 *   - `name` (display title), `userRole`, `price`, `billingCycle`, `status`
 *   - `billingCycle` values are restricted to `SixMonth` (6mo) and `Year` (12mo).
 *     The previous wider enum (`Month`, `Quarter`) is deprecated by the BE.
 *   - `status` is a boolean (true = active, false = inactive) on the plan
 *   - Purchase `status` is a string enum (`Pending|Paid|Failed|Cancelled`)
 */

/**
 * Allowed billing cycles for a fee plan.
 *
 * The BE only accepts `SixMonth` and `Annual` on create/update — earlier
 * values (`Month`, `Quarter`, `Year`) were dropped from the contract.
 * Sending them now returns `400: BillingCycle must be 'SixMonth' or 'Annual'`.
 */
export type AnnualFeeBillingCycle = 'Annual' | 'SixMonth';

export type AnnualFeeTargetRole =
  | 'Researcher'
  | 'Lecturer'
  | 'Admin'
  | 'Reviewer'
  | 'GraduateStudent';

export type AnnualFeePurchaseStatus =
  | 'Pending'
  | 'Paid'
  | 'Failed'
  | 'Cancelled';

/** Admin-managed annual fee plan definition */
export interface AnnualFee {
  id: number;
  /** Display name, e.g. "Researcher Yearly" */
  name: string;
  /** The role this fee applies to */
  userRole: AnnualFeeTargetRole;
  /** Price in VND. Whole-number currency units, no decimals. */
  price: number;
  /** Billing cadence — BE accepts `SixMonth` or `Year` only. */
  billingCycle: AnnualFeeBillingCycle;
  /**
   * Number of active subscribers currently attached to this plan.
   * Populated by the BE on the list/get response. When this is `> 0`,
   * the FE blocks the admin from deactivating or deleting the plan.
   *
   * Optional in the type because the BE may omit it for plans with
   * zero subscribers; the FE treats `undefined` as `0`.
   */
  activeSubscriberCount?: number;
  /** Whether new purchases are currently accepted for this plan */
  status: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Request body for admin to create/update an annual fee plan */
export interface AnnualFeeUpsertRequest {
  name: string;
  userRole: AnnualFeeTargetRole;
  price: number;
  billingCycle: AnnualFeeBillingCycle;
  /**
   * Always `true` for newly created plans. Admin "closes" a plan by
   * toggling `status` to `false` via the toggle endpoint — not by
   * setting a date range.
   */
  status: boolean;
}

/** Toggle request body — partial update for plan active state */
export interface AnnualFeeToggleRequest {
  status: boolean;
}

/**
 * A user currently subscribed to a specific annual fee plan.
 *
 * Returned by the admin subscribers endpoint:
 *   `GET /api/AnnualFees/{planId}/subscribers`
 *
 * Fields are the BE's exact wire names:
 *   - `username`  — the user's display name (NOT email; the BE does not
 *     surface the email address in this response)
 *   - `expiresAt` — ISO 8601 datetime of when this subscription expires
 *   - `userRole`  — the role under which this subscription was purchased
 *     (e.g. "Researcher", "Lecturer")
 */
export interface AnnualFeeSubscriber {
  /** DB id of the subscription record */
  userSubscriptionId: number;
  /** BE user id */
  userId: number;
  /** User's display name on the platform */
  username: string;
  /** Role under which the subscription was purchased */
  userRole: string;
  /**
   * ISO 8601 datetime of when the subscription expires.
   * Powers the "Expiry" column in the admin subscribers modal.
   */
  expiresAt: string | null;
  /** Id of the latest successful payment transaction, if any */
  latestTransactionId: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Params for listing the subscribers of a single plan. */
export interface AnnualFeeSubscriberListParams {
  page?: number;
  pageSize?: number;
}

/** Paged wrapper for the subscribers endpoint. */
export interface AnnualFeeSubscriberListResult {
  items: AnnualFeeSubscriber[];
  total: number;
  page: number;
  pageSize: number;
}

/** Toggle request body — partial update for plan active state */
export interface AnnualFeeToggleRequest {
  status: boolean;
}

/** User's annual fee purchase record */
export interface AnnualFeePurchase {
  /** Transaction ID (PayOS order code) — primary identifier returned by BE */
  transactionId: string;
  userId: number;
  annualFeeId: number;
  /** Embedded plan summary when the BE returns it inline */
  annualFee?: AnnualFee | null;
  /** Snapshot of price at purchase time (VND) */
  amount: number;
  /** Lifecycle status of this transaction */
  status: AnnualFeePurchaseStatus;
  description?: string | null;
  paymentDescription?: string | null;
  paymentMethod?: string | null;
  paymentOrderId?: string | null;
  createdAt: string;
  /** Set when status flips to `Paid`. Null while `Pending`. */
  expiryDate?: string | null;
}

/** Request to initiate an annual fee purchase (creates PayOS payment link) */
export interface AnnualFeePurchaseRequest {
  /** Optional override for the post-payment return URL */
  returnUrl?: string | null;
  /** Optional override for the post-cancel return URL */
  cancelUrl?: string | null;
}

/** Response from initiating a purchase (contains PayOS checkout URL) */
export interface AnnualFeePurchaseResponse {
  /** Authorized PayOS checkout URL — FE redirects the browser here */
  checkoutUrl: string;
  /** PayOS order code (also matches purchase.transactionId) */
  orderCode: string;
  /** The created purchase record (may be in `Pending` status) */
  purchase: AnnualFeePurchase;
}

/**
 * User's current active subscription (or null if none).
 *
 * The BE's `GET /api/AnnualFees/my-subscription` returns this shape. The
 * `purchase` field was the historical owner of `expiryDate`; it may now
 * arrive as `null` when the BE migrated `ExpiresAt` to `UserSubscriptions`.
 * A `expiresAt` field sourced from `UserSubscriptions.expiresAt` is used as
 * the primary expiry signal when `purchase` is absent.
 *
 * BE-authored fields (`daysRemaining`, `isExpired`) are always trusted over
 * any client-side date arithmetic.
 */
export interface CurrentAnnualFeeSubscription {
  /**
   * The purchase record. May be `null` when the BE migrated expiry tracking
   * to `UserSubscriptions`. Use `expiresAt` below as the primary signal.
   */
  purchase: AnnualFeePurchase | null;
  annualFee: AnnualFee;
  /** Days remaining until expiry (negative if already expired). */
  daysRemaining: number;
  /** Authoritative BE-computed expired flag — trust this over client math. */
  isExpired: boolean;
  /**
   * ISO timestamp sourced from `UserSubscriptions.expiresAt` (the BE's new
   * canonical expiry field). Present when the BE returned a subscription row;
   * `null` when the user has no active subscription.
   * Use this as the primary expiry signal when `purchase` is `null`.
   */
  expiresAt?: string | null;
}

/** Generic paged response wrapper from BE endpoints */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Filter parameters for the admin plan listing endpoint */
export interface AnnualFeeListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  userRole?: AnnualFeeTargetRole | '';
  billingCycle?: AnnualFeeBillingCycle | '';
  /** "ACTIVE" | "INACTIVE" filter on the plan's `status` boolean */
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
  sortBy?: 'Price' | 'Name' | 'CreatedAt';
  sortDir?: 'asc' | 'desc';
}

/** Filter parameters for the user-facing active plans endpoint */
export interface ActiveAnnualFeeListParams {
  page?: number;
  pageSize?: number;
}

/** Filter parameters for the user's purchase history endpoint */
export interface PurchaseHistoryParams {
  page?: number;
  pageSize?: number;
}

/**
 * Transaction types.
 *
 * Mirrors the BE-published `/api/Transaction` contract
 * (`swagger.json` § Transaction). The FE admin transactions page is
 * read-only — it surfaces the audit trail of every ARS payment /
 * wallet event so an admin can confirm a subscription purchase was
 * recorded.
 *
 * Field naming follows the BE wire format exactly (PascalCase keys):
 *   - `transactionId`   int (PK)
 *   - `walletId`        int | null  (null for non-wallet flows)
 *   - `type`            string | null  (e.g. 'AnnualFee', 'Topup', 'Withdrawal')
 *   - `amount`          number | null  (VND)
 *   - `status`          string | null  (e.g. 'Pending', 'Paid', 'Failed', 'Cancelled')
 *   - `description`     string | null
 *   - `createdAt`       ISO-8601 string | null
 *   - `annualFeeId`     int | null  (link to the plan the user paid for, when applicable)
 *   - `userId`          int | null  (the paying user)
 *   - `paymentDescription` string | null  (PayOS-side description)
 *   - `paymentOrderId`  string | null  (PayOS order id)
 *   - `paymentResponseCode` string | null  (PayOS return code)
 */

export type TransactionType = string;
export type TransactionStatus = string;

/**
 * A single transaction record as returned by the BE.
 *
 * The BE marks most fields as nullable because older rows in the DB
 * (pre-migration) did not populate them. The FE defensive-parses every
 * field and renders `—` for null/undefined.
 */
export interface TransactionResponse {
  transactionId: number;
  walletId: number | null;
  type: TransactionType | null;
  amount: number | null;
  status: TransactionStatus | null;
  description: string | null;
  createdAt: string | null;
  annualFeeId: number | null;
  userId: number | null;
  paymentDescription: string | null;
  paymentOrderId: string | null;
  paymentResponseCode: string | null;
}

/** Paged wrapper for the BE `/api/Transaction/paged` response. */
export interface TransactionPagedResult {
  items: TransactionResponse[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

/**
 * Filter parameters for the admin transactions list.
 *
 * The BE's free-text `Search` field matches the BE's wire shape — it
 * currently matches `paymentOrderId` / `description` / `paymentDescription`
 * (the BE doesn't document a `userId` matcher on this endpoint, so we
 * filter by `userId` client-side after the fetch).
 */
export interface TransactionListParams {
  page?: number;
  pageSize?: number;
  /**
   * Free-text needle. Send `undefined` / empty to skip the filter.
   * The BE matches this against `description` / `paymentDescription`
   * (and possibly `paymentOrderId`).
   */
  search?: string;
}

/**
 * Status filter exposed in the admin UI. The BE accepts an arbitrary
 * `Status` string; we narrow the choice to the four values the
 * PayOS-backed `AnnualFeePurchase` flow actually emits.
 */
export const KNOWN_TRANSACTION_STATUSES = [
  'Pending',
  'Paid',
  'Failed',
  'Cancelled',
] as const;

export type KnownTransactionStatus =
  (typeof KNOWN_TRANSACTION_STATUSES)[number];

/**
 * Type filter exposed in the admin UI. The BE surfaces whatever the
 * domain layer stored, so the list is the union of documented + observed
 * values. Empty string = "All".
 */
export const KNOWN_TRANSACTION_TYPES = [
  'AnnualFee',
  'Topup',
  'Withdrawal',
  'Payout',
] as const;

export type KnownTransactionType = (typeof KNOWN_TRANSACTION_TYPES)[number];

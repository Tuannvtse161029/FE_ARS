// Strict DTOs that mirror the planned Swagger contract for the
// Researcher / Lecturer subscription resource. These shapes are the
// SINGLE source of truth for what the FE expects the BE to publish.
//
// Each interface is named after the BE-facing resource it mirrors:
//
//   - SubscriptionPlan       — read shape (response) for the plan list
//   - UserSubscription       — read shape (response) for the current
//                              user's subscription snapshot
//   - SubscriptionOrderRequest  — write shape for creating a PayOS order
//   - SubscriptionOrderResponse — read shape returned by the BE after
//                                 it has talked to PayOS
//   - SubscriptionPaymentStatus — read shape for a payment/order status
//
// Every property is `T | null` (or `number | null`) where the planned
// Swagger spec marks the field as `nullable: true`. The FE treats
// "absent" and "null" identically on both request and response
// shapes.
//
// The live backend has not yet published this resource. The production
// FE therefore renders an explicit `SubscriptionBackendUnavailableError`
// banner until the contract ships; it never fabricates subscription
// rows or prices.

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'PENDING_PAYMENT'
  | 'CANCELLED';

export type SubscriptionPaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

export type SubscriptionCurrency = 'VND';

export interface SubscriptionPlan {
  id: number;
  /** Plan length in months. Only `6` and `12` are supported today. */
  durationMonths: number;
  /** Price in VND. Whole-number currency units, no decimals. */
  priceVnd: number;
  /** ISO-4217 currency code. Always `VND` for ARS subscriptions. */
  currency: SubscriptionCurrency | string;
  /** Whether new purchases are currently accepted for this plan. */
  isActive: boolean;
}

export interface UserSubscription {
  id: number;
  userId: number;
  planId: number;
  /** Lifecycle of the subscription. */
  status: SubscriptionStatus;
  /** ISO timestamp; subscription becomes active at this moment. */
  startsAt: string;
  /** ISO timestamp; subscription is considered expired past this moment. */
  expiresAt: string;
  /** PayOS order code that produced (or is producing) this subscription. */
  paymentOrderCode: string | null;
  /** Optional plan summary surfaced with the subscription. */
  plan?: SubscriptionPlan | null;
}

export interface SubscriptionOrderRequest {
  planId: number;
  /**
   * URLs PayOS should use for the post-payment redirects. Both are
   * optional; the BE may provide defaults. The FE never relies on
   * browser query parameters to decide whether access is granted.
   */
  returnUrl?: string | null;
  cancelUrl?: string | null;
}

export interface SubscriptionOrderResponse {
  orderCode: string;
  status: SubscriptionPaymentStatus;
  /** Authorized PayOS checkout URL. The FE redirects the browser here. */
  checkoutUrl: string;
  /** Optional expiry for the checkout URL. */
  expiresAt?: string | null;
  /** Convenience echo of the chosen plan. */
  plan?: SubscriptionPlan | null;
}

export interface SubscriptionPaymentStatusResponse {
  orderCode: string;
  status: SubscriptionPaymentStatus;
  checkoutUrl: string | null;
  paidAt: string | null;
  /** Current subscription state for this order, if it has been linked. */
  subscription?: UserSubscription | null;
}

/**
 * Error class the FE surfaces when the BE has not yet published the
 * subscription contract. Pages render an explicit banner instead of
 * pretending the API works.
 */
export class SubscriptionBackendUnavailableError extends Error {
  constructor(
    message = 'Subscription payment integration awaiting backend API and VND pricing configuration.',
  ) {
    super(message);
    this.name = 'SubscriptionBackendUnavailableError';
  }
}

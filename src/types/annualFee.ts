/**
 * Annual Fee types.
 *
 * Core concepts:
 *   - AnnualFee: Admin-configured fee plans (price, billing cycle, features)
 *   - AnnualFeePurchase: User's purchase record with expiry tracking
 */

export type AnnualFeeBillingCycle = 'Quarterly' | 'SixMonth' | 'Annual';

export type AnnualFeeTargetRole = 'Researcher' | 'Lecturer';

export type AnnualFeePurchaseStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING_PAYMENT';

/** Admin-managed annual fee plan definition */
export interface AnnualFee {
  id: number;
  /** Human-readable plan title — e.g. "Researcher Annual Fee" */
  title: string;
  /** The role this fee applies to */
  targetRole: AnnualFeeTargetRole;
  /** Price in VND. Whole-number currency units, no decimals. */
  priceVnd: number;
  /** Billing cadence: Quarterly (3mo), SixMonth (6mo), Annual (12mo) */
  billingCycle: AnnualFeeBillingCycle;
  /** Feature bullet list displayed in the subscription UI */
  features: string[];
  /** Whether new purchases are currently accepted for this plan */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Request body for admin to create/update an annual fee plan */
export interface AnnualFeeUpsertRequest {
  title: string;
  targetRole: AnnualFeeTargetRole;
  priceVnd: number;
  billingCycle: AnnualFeeBillingCycle;
  features: string[];
  isActive: boolean;
}

/** User's annual fee purchase record */
export interface AnnualFeePurchase {
  id: number;
  userId: number;
  annualFeeId: number;
  /** Reference to the plan that was purchased */
  annualFee?: AnnualFee;
  /** When the user purchased this plan */
  purchaseDate: string;
  /** When this subscription expires */
  expiryDate: string;
  /** Current status: ACTIVE, EXPIRED, CANCELLED, PENDING_PAYMENT */
  status: AnnualFeePurchaseStatus;
  /** Payment method used: PayOS, etc. */
  paymentMethod?: string;
  /** External transaction/payment reference */
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Request to initiate an annual fee purchase (creates PayOS payment link) */
export interface AnnualFeePurchaseRequest {
  annualFeeId: number;
  returnUrl: string;
  cancelUrl: string;
}

/** Response from initiating a purchase (contains PayOS checkout URL) */
export interface AnnualFeePurchaseResponse {
  checkoutUrl: string;
  orderCode: string;
  /** The created purchase record (may be in PENDING_PAYMENT status) */
  purchase: AnnualFeePurchase;
}

/** User's current active subscription (or null if none) */
export interface CurrentAnnualFeeSubscription {
  purchase: AnnualFeePurchase;
  annualFee: AnnualFee;
  /** Days remaining until expiry (negative if already expired) */
  daysRemaining: number;
  isExpired: boolean;
}

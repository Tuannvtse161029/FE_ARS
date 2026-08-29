// Strict DTOs that mirror the planned Swagger contract for the
// admin Annual-Fees resource. These are the *single source of truth*
// for what the FE expects the BE to publish; service-layer code must
// use these types instead of inline `Record<string, unknown>` blobs.
//
// Each interface is named after the BE-facing resource it mirrors:
//
//   - AnnualFeeDto          — read shape (response)
//   - AnnualFeeUpsertRequest — write shape (request) for create / update
//
// Every property is `T | null` (or `number | null`) because the planned
// Swagger spec marks each field as `nullable: true`. The FE therefore
// treats "absent" and "null" identically on both request and response
// shapes — see the BE gap ticket for the documented gaps.
//
// Agent admin-annual-fees — the BE has not yet published this resource
// (confirmed against the live Swagger feed on 2026-08-25). The FE
// Annual Fees tab therefore renders against a dedicated demo-data
// module (src/data/annualFees.demo.ts) and surfaces the
// "Demo data — awaiting backend API" banner everywhere the data is
// shown. When the BE ships the contract, swap the demo module for the
// real service calls and remove the banner.

export type AnnualFeeBillingCycle = 'Annual' | 'SixMonth';

export interface AnnualFeeDto {
  id: number;
  /** The role this fee is targeted at (Researcher / Lecturer). */
  targetRole: string;
  /** Human-readable plan title — e.g. "Researcher Annual Fee". */
  title: string;
  /** Price in VND. Whole-number currency units, no decimals. */
  priceVnd: number;
  /** Annual (12 months) or six-month (6 months) billing cadence. */
  billingCycle: AnnualFeeBillingCycle | string;
  /** Free-form bullet list shown in the Admin Annual Fees table. */
  features?: string[] | null;
  /** Whether new purchases are currently accepted for this fee. */
  isActive: boolean;
  /** ISO timestamp of the last write. */
  updatedAt?: string | null;
}

export interface AnnualFeeCreateRequest {
  targetRole: string;
  title: string;
  priceVnd: number;
  billingCycle: string;
  features?: string[] | null;
  isActive: boolean;
}

export interface AnnualFeeUpdateRequest {
  targetRole: string;
  title: string;
  priceVnd: number;
  billingCycle: string;
  features?: string[] | null;
  isActive: boolean;
}

export interface AnnualFeeFilterParams {
  isActive?: boolean;
  targetRole?: string;
  billingCycle?: string;
}

export type AnnualFeeUpsertRequest = AnnualFeeCreateRequest;
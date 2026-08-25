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
  id: number | null;
  /** The role this fee is targeted at. Mirrors `AccountRoleName` from
   *  src/types/admin.ts; the BE should echo the existing constants. */
  targetRole: string | null;
  /** Human-readable plan title — e.g. "Researcher Annual Fee". */
  title: string | null;
  /** Price in VND. Whole-number currency units, no decimals. */
  priceVnd: number | null;
  /** Annual (12 months) or six-month (6 months) billing cadence. */
  billingCycle: AnnualFeeBillingCycle | null;
  /** Free-form bullet list shown in the Admin Annual Fees table. */
  features: string[] | null;
  /** Whether new purchases are currently accepted for this fee. */
  isActive: boolean | null;
  /** ISO timestamp of the last write. `null` until the BE persists. */
  updatedAt: string | null;
}

export interface AnnualFeeUpsertRequest {
  id: number | null;
  targetRole: string | null;
  title: string | null;
  priceVnd: number | null;
  billingCycle: AnnualFeeBillingCycle | null;
  features: string[] | null;
  isActive: boolean | null;
}
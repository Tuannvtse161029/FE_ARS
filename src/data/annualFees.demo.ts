// Demo fixtures for the Admin Annual Fees tab.
//
// Agent admin-annual-fees — the BE has not yet published the
// annual-fee CRUD endpoint (confirmed against the live Swagger feed on
// 2026-08-25). Until the contract lands, the FE renders every row from
// this module so the Admin surface is testable end-to-end without a
// live API.
//
// Two principles the rest of the codebase can rely on:
//
//   1. The values here are STRICTLY demo. They never flow into the
//      production payment logic (`src/services/payment.service.ts` or
//      the PayOS redirect). The Admin Annual Fees tab is read/write UI
//      only — no checkout, no wallet debit, no invoice creation.
//
//   2. The fixtures are isolated to this module. Components and tests
//      import from here, not from inline literals, so a single edit
//      covers every consumer.
//
// When the BE publishes the contract, replace the body of
// `src/services/annualFee.service.ts` with real axios calls and delete
// this module. The AnnualFees page itself only consumes the service,
// so the page does not need to change.

import type {
  AnnualFeeBillingCycle,
  AnnualFeeDto,
} from '../types/annualFee';

export const ANNUAL_FEES_DEMO_NOTICE =
  'Demo data — awaiting backend API';

const DEMO_FEATURES: readonly string[] = [
  'Priority paper review queue',
  'Verified-researcher badge on forum posts',
  'Discounted wallet top-up fees',
];

export interface DemoAnnualFeeRow {
  readonly id: number;
  readonly targetRole: 'Researcher' | 'Lecturer';
  readonly title: string;
  readonly priceVnd: number;
  readonly billingCycle: AnnualFeeBillingCycle;
  readonly features: readonly string[];
  readonly isActive: boolean;
  readonly updatedAt: string;
}

/**
 * Example fees for the two documented roles — Researcher and Lecturer —
 * across the two billing cycles (Annual and Six-month). Reviewer /
 * Graduate Student / Guest are intentionally omitted because no
 * business decision has been made for those tiers.
 */
export const DEMO_ANNUAL_FEES: ReadonlyArray<DemoAnnualFeeRow> = [
  {
    id: 1,
    targetRole: 'Researcher',
    title: 'Researcher Annual Fee',
    priceVnd: 990_000,
    billingCycle: 'Annual',
    features: DEMO_FEATURES,
    isActive: true,
    updatedAt: '2026-08-25T00:00:00.000Z',
  },
  {
    id: 2,
    targetRole: 'Researcher',
    title: 'Researcher Six-Month Fee',
    priceVnd: 549_000,
    billingCycle: 'SixMonth',
    features: DEMO_FEATURES,
    isActive: true,
    updatedAt: '2026-08-25T00:00:00.000Z',
  },
  {
    id: 3,
    targetRole: 'Lecturer',
    title: 'Lecturer Annual Fee',
    priceVnd: 1_290_000,
    billingCycle: 'Annual',
    features: DEMO_FEATURES,
    isActive: true,
    updatedAt: '2026-08-25T00:00:00.000Z',
  },
  {
    id: 4,
    targetRole: 'Lecturer',
    title: 'Lecturer Six-Month Fee',
    priceVnd: 699_000,
    billingCycle: 'SixMonth',
    features: DEMO_FEATURES,
    isActive: false,
    updatedAt: '2026-08-25T00:00:00.000Z',
  },
];

/**
 * Cast the demo fixtures to the strict DTO shape. Done once here so
 * every consumer sees a single canonical `AnnualFeeDto[]`.
 */
export const DEMO_ANNUAL_FEES_DTO: ReadonlyArray<AnnualFeeDto> =
  DEMO_ANNUAL_FEES.map((row) => ({
    id: row.id,
    targetRole: row.targetRole,
    title: row.title,
    priceVnd: row.priceVnd,
    billingCycle: row.billingCycle,
    features: [...row.features],
    isActive: row.isActive,
    updatedAt: row.updatedAt,
  }));
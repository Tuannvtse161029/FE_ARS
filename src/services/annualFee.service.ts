// Agent admin-annual-fees — admin annual-fees service stub.
//
// The BE has not yet published the annual-fee CRUD endpoint (confirmed
// against the live Swagger feed on 2026-08-25). Until the contract
// lands, every method in this module short-circuits to the demo-data
// module (src/data/annualFees.demo.ts) so the Admin Annual Fees tab is
// renderable end-to-end without a live API.
//
// Rules of engagement while the stub is in place:
//
//   1. NO axios call is made. The service is wired with the shared
//      `src/services/axios.ts` instance for the day the BE ships, but
//      until then every method reads from the demo module.
//   2. NO values are scattered across components. Every consumer reads
//      from `annualFeeService.listAnnualFees()` so a single edit covers
//      every Admin screen.
//   3. NO production payment path is touched. The service exposes
//      list/get only — there is no `createAnnualFee` yet because the
//      BE contract has not locked the write shape.
//
// When the BE publishes the contract:
//   - Drop the demo short-circuit.
//   - Implement `getAnnualFees` / `getAnnualFee` against the new
//     Swagger `GET /api/AnnualFee` + `GET /api/AnnualFee/{id}` routes.
//   - Add `createAnnualFee` / `updateAnnualFee` / `toggleAnnualFee`
//     against the corresponding write endpoints.
//   - Surface the actual `AnnualFeeDto` shape returned by the BE in
//     `src/types/annualFee.ts`.
//
// The expected contract is documented in
// `docs/BACKEND_REQUESTS.md` → Agent Admin Annual Fees — BTR-AF-01.

import { DEMO_ANNUAL_FEES_DTO } from '../data/annualFees.demo';
import type { AnnualFeeDto } from '../types/annualFee';

// Centralized feature gate — mirrors the existing pattern in
// `src/config/app.ts`. Until the BE ships the contract we short-circuit
// to the demo module. When the endpoint lands, flip this to `true` and
// the service will start hitting the live routes.
//
// The flag also lets tests assert "the service returned demo data, not
// the real network" without mocking axios.
const USE_LIVE_ANNUAL_FEE_API = false;

// Centralized sentinel so any code path that tries to mutate demo data
// from outside this module fails fast. The Admin Annual Fees tab is
// read-only for now — see the `// TODO` block at the bottom of this
// file.
export class AnnualFeeServiceNotReadyError extends Error {
  constructor(method: string) {
    super(
      `annualFeeService.${method} is read-only until the BE ships the annual-fee CRUD endpoint. See docs/BACKEND_REQUESTS.md (BTR-AF-01).`,
    );
    this.name = 'AnnualFeeServiceNotReadyError';
  }
}

// Simulated latency so loading skeletons render consistently during
// development. Matches the `MOCK_LATENCY_MS` used in
// `adminAuxiliary.service.ts` so the Admin suite has a single UX feel.
const MOCK_LATENCY_MS = 200;

const delay = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));

// Deep clones keep demo mutations local to this module so reloads reset
// state, mirroring the convention in `adminAuxiliary.service.ts`.
const clone = <T>(value: T): T =>
  value == null || typeof value !== 'object' ? value : JSON.parse(JSON.stringify(value));

// In-memory mutable copy of the demo fixtures. A future "reset for
// tests" helper can restore the fixture from `DEMO_ANNUAL_FEES_DTO`.
// Exported as `__resetAnnualFeeMockStore` so vitest specs can reset
// state without touching the demo module.
const annualFeeStore: AnnualFeeDto[] = clone(
  DEMO_ANNUAL_FEES_DTO,
) as AnnualFeeDto[];

export const __resetAnnualFeeMockStore = (): void => {
  annualFeeStore.splice(
    0,
    annualFeeStore.length,
    ...(clone(DEMO_ANNUAL_FEES_DTO) as AnnualFeeDto[]),
  );
};

async function listAnnualFees(): Promise<AnnualFeeDto[]> {
  if (USE_LIVE_ANNUAL_FEE_API) {
    // Real axios path. Wired but unreachable until the BE ships the
    // contract — kept here so the next agent only has to flip the
    // flag and confirm the request shape.
    const { default: api } = await import('./axios');
    const { API_ENDPOINTS } = await import('../utils/constants');
    const response = await api.get<AnnualFeeDto[]>(
      API_ENDPOINTS.ADMIN.ANNUAL_FEES.GET_ALL,
    );
    return response.data ?? [];
  }
  return delay(clone(annualFeeStore));
}

async function getAnnualFee(id: number): Promise<AnnualFeeDto | null> {
  if (USE_LIVE_ANNUAL_FEE_API) {
    const { default: api } = await import('./axios');
    const { API_ENDPOINTS } = await import('../utils/constants');
    const response = await api.get<AnnualFeeDto>(
      API_ENDPOINTS.ADMIN.ANNUAL_FEES.GET_BY_ID(id),
    );
    return response.data ?? null;
  }
  const hit = annualFeeStore.find((row) => row.id === id);
  return delay(hit ? clone(hit) : null);
}

// TODO: When the BE contract lands, add:
//   - createAnnualFee(req: AnnualFeeUpsertRequest): Promise<AnnualFeeDto>
//   - updateAnnualFee(id: number, req: AnnualFeeUpsertRequest): Promise<AnnualFeeDto>
//   - toggleAnnualFee(id: number, isActive: boolean): Promise<AnnualFeeDto>
//   - deleteAnnualFee(id: number): Promise<void>
// All of them must follow the same `if (USE_LIVE_ANNUAL_FEE_API)`
// short-circuit pattern so the demo path stays coherent.

export const annualFeeService = {
  listAnnualFees,
  getAnnualFee,
  __resetAnnualFeeMockStore,
};

export default annualFeeService;
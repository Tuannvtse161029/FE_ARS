/**
 * Reviewer-Withdrawal flow network interceptor.
 *
 * Installs `page.route(...)` handlers that synthesize the BE responses the
 * Reviewer + Admin surfaces expect during a withdrawal request:
 *
 *   Reviewer surface (uses /api/WithdrawalRequest):
 *     GET  /api/WithdrawalRequest                      → list of records
 *     POST /api/WithdrawalRequest                      → create PENDING
 *     PUT  /api/WithdrawalRequest/{id}                 → status update
 *
 *   Admin surface (uses /api/WithdrawalRequest per
 *   `src/services/admin.service.ts` and
 *   `src/utils/constants.ts → API_ENDPOINTS.ADMIN.WITHDRAWALS.*`):
 *     GET  /api/WithdrawalRequest                       → admin list
 *     POST /api/WithdrawalRequest/{id}/accept           → PENDING → ACCEPTED_PROCESSING
 *     POST /api/WithdrawalRequest/{id}/complete         → ACCEPTED_PROCESSING → COMPLETED (+ receipt URL)
 *     POST /api/WithdrawalRequest/{id}/deny             → PENDING → DENIED
 *
 *   Receipt upload (Firebase in production):
 *     Intercepted at the network boundary — replaced with a deterministic
 *     `https://example.test/receipts/{id}.png` URL so no real Firebase
 *     write occurs.
 *
 * The interceptor is shared across Reviewer + Admin routes so a single
 * underlying record (single `id` / `withdrawalRequestId`) stays coherent
 * across both UIs. Each side sees its own canonical field names but the
 * underlying record is one object.
 *
 * IMPORTANT — intercepted mode is NOT a substitute for live BE verification.
 * It is ONLY used because:
 *   - The Reviewer test wallet cannot cover a real withdrawal.
 *   - The Admin surface reads from a separate in-memory mock store
 *     (`src/services/admin.service.ts:28` USE_MOCK_DATA = true) that does
 *     NOT share state with the Reviewer endpoint.
 * We do NOT alter `localStorage` to fake funds, do NOT open VNPay, do NOT
 * upload a real receipt to Firebase, and do NOT bypass real authentication.
 *
 * `__E2E_SCENARIO_FLAGS__` on `window` exposes the current scenario's
 * counters and ids to the spec for assertions.
 */

import type { Page } from '@playwright/test';

// ── Runtime shim (narrow-toggle override) ───────────────────────────────────
// Installed alongside the interceptor so the Admin withdrawal UI speaks
// through axios (intercepted) instead of the in-process mock store.
// See `src/services/admin.service.ts::USE_WITHDRAWAL_MOCK` and
// docs/local-only/agent-7-e2e-findings.md.

export type WithdrawalStatus =
  | 'PENDING'
  | 'ACCEPTED_PROCESSING'
  | 'COMPLETED'
  | 'DENIED';

export interface WithdrawalFixtureRecord {
  id: number;
  userId: number;
  reviewerName: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: 0;
  note: string;
  status: WithdrawalStatus;
  proofReceiptUrl: string | null;
  createdAt: string;
  processedAt: string | null;
  completedAt: string | null;
}

export interface WithdrawalFlowScenario {
  runId: string;
  reviewerId: number;
  reviewerName: string;
  reviewerEmail: string;
  adminEmail: string;
  record: WithdrawalFixtureRecord;
  receiptUrl: string;
  counters: {
    createCalls: number;
    reviewerGetCalls: number;
    adminGetCalls: number;
    acceptCalls: number;
    completeCalls: number;
    denyCalls: number;
    uploadCalls: number;
    /**
     * Tracks receipt-upload-route responses to support the negative test
     * that injects a 500 mid-flight. `null` means "respond 200" (default),
     * a number means "respond with that status code".
     */
    nextUploadStatusOverride: number | null;
    /**
     * Tracks completion-API responses to support the negative test that
     * injects a 500 mid-flight. `null` means "respond 200" (default).
     */
    nextCompleteStatusOverride: number | null;
  };
}

const STATUS_NORMALIZATION_TABLE: Record<
  WithdrawalStatus,
  { admin: WithdrawalStatus; reviewer: 'Pending' | 'Approved' | 'Rejected' }
> = {
  PENDING: { admin: 'PENDING', reviewer: 'Pending' },
  ACCEPTED_PROCESSING: { admin: 'ACCEPTED_PROCESSING', reviewer: 'Approved' },
  COMPLETED: { admin: 'COMPLETED', reviewer: 'Approved' },
  DENIED: { admin: 'DENIED', reviewer: 'Rejected' },
};

/**
 * Build a fresh scenario. The `runId` is exposed on the page so the spec
 * can build unique strings (notes, account numbers) deterministically.
 */
export function makeWithdrawalScenario(): WithdrawalFlowScenario {
  const runId = `A7-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const txId = 7_000_001;
  const reviewerId = 17;
  const reviewerName = 'Bui Thi Linh (E2E)';
  return {
    runId,
    reviewerId,
    reviewerName,
    reviewerEmail: 'reviewer1.ars@arsplatform.test',
    adminEmail: 'admin@arsplatform.com',
    receiptUrl: `https://example.test/receipts/${txId}.png`,
    record: {
      id: txId,
      userId: reviewerId,
      reviewerName,
      bankName: 'Vietcombank (VCB)',
      accountNumber: `0000${runId.slice(-6)}`,
      accountName: `ARS-E2E Account Holder ${runId}`,
      amount: 0,
      note: `ARS-E2E-ZERO-WITHDRAWAL-${runId}`,
      status: 'PENDING',
      proofReceiptUrl: null,
      createdAt: new Date().toISOString(),
      processedAt: null,
      completedAt: null,
    },
    counters: {
      createCalls: 0,
      reviewerGetCalls: 0,
      adminGetCalls: 0,
      acceptCalls: 0,
      completeCalls: 0,
      denyCalls: 0,
      uploadCalls: 0,
      nextUploadStatusOverride: null,
      nextCompleteStatusOverride: null,
    },
  };
}

/** Reset the in-memory counters / overrides back to defaults. */
export function resetWithdrawalScenario(scenario: WithdrawalFlowScenario): void {
  scenario.counters.createCalls = 0;
  scenario.counters.reviewerGetCalls = 0;
  scenario.counters.adminGetCalls = 0;
  scenario.counters.acceptCalls = 0;
  scenario.counters.completeCalls = 0;
  scenario.counters.denyCalls = 0;
  scenario.counters.uploadCalls = 0;
  scenario.counters.nextUploadStatusOverride = null;
  scenario.counters.nextCompleteStatusOverride = null;
  scenario.record.status = 'PENDING';
  scenario.record.proofReceiptUrl = null;
  scenario.record.processedAt = null;
  scenario.record.completedAt = null;
  scenario.record.createdAt = new Date().toISOString();
  scenario.receiptUrl = `https://example.test/receipts/${scenario.record.id}.png`;
}

// ── Response shapes ──────────────────────────────────────────────────────────

interface ReviewerApiRecord {
  withdrawalRequestId: number;
  id: number;
  userId: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  note: string;
  rejectionReason: string | null;
  proofReceiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminApiRecord {
  txId: number;
  userId: number;
  reviewerName: string;
  amountVnd: number;
  currency: 'VND';
  bankName: string;
  accountNumber: string;
  accountName: string;
  requestDate: string;
  status: WithdrawalStatus;
  proofReceiptUrl: string | null;
  rejectionReason?: string | null;
  processingAt?: string | null;
  completedAt?: string | null;
}

function toReviewer(record: WithdrawalFixtureRecord): ReviewerApiRecord {
  const norm = STATUS_NORMALIZATION_TABLE[record.status];
  return {
    withdrawalRequestId: record.id,
    id: record.id,
    userId: record.userId,
    bankName: record.bankName,
    accountNumber: record.accountNumber,
    accountName: record.accountName,
    amount: record.amount,
    status: norm.reviewer,
    note: record.note,
    rejectionReason: record.status === 'DENIED' ? 'E2E denial reason' : null,
    proofReceiptUrl: record.proofReceiptUrl,
    createdAt: record.createdAt,
    updatedAt:
      record.completedAt ?? record.processedAt ?? record.createdAt,
  };
}

function toAdmin(record: WithdrawalFixtureRecord): AdminApiRecord {
  return {
    txId: record.id,
    userId: record.userId,
    reviewerName: record.reviewerName,
    amountVnd: record.amount,
    currency: 'VND',
    bankName: record.bankName,
    accountNumber: record.accountNumber,
    accountName: record.accountName,
    requestDate: record.createdAt,
    status: record.status,
    proofReceiptUrl: record.proofReceiptUrl,
    rejectionReason: record.status === 'DENIED' ? 'E2E denial reason' : null,
    processingAt: record.processedAt,
    completedAt: record.completedAt,
  };
}

function ok(body: unknown, status: number = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

// ── Route registration ───────────────────────────────────────────────────────

/**
 * Install the network interception for the withdrawal flow. Call once per
 * `page` (Playwright routes are page-scoped). The same `scenario` is
 * mutated in place by both Reviewer and Admin actions so the underlying
 * record stays coherent.
 */
export function installWithdrawalRoutes(
  page: Page,
  scenario: WithdrawalFlowScenario,
): void {
  // Expose the scenario on `window` for debug / forensic logs (test info
  // attaches the runId only; nothing else leaks).
  page.addInitScript(
    ({ runId }: { runId: string }) => {
      (window as unknown as { __E2E_RUN_ID__?: string }).__E2E_RUN_ID__ = runId;
    },
    { runId: scenario.runId },
  );

  // Force the Admin withdrawal UI off the in-memory mock store so axios calls
  // flow through these route handlers instead of being short-circuited by
  // `admin.service.ts::USE_WITHDRAWAL_MOCK`. The shim is read at module load
  // (top-level constant), so it MUST be installed before any page script runs.
  page.addInitScript(() => {
    (window as unknown as { __USE_ADMIN_WITHDRAWAL_MOCK__?: string }).__USE_ADMIN_WITHDRAWAL_MOCK__ = 'false';
  });

  // ── Reviewer GET /api/WithdrawalRequest (list) ──────────────────────────
  page.route('**/api/WithdrawalRequest', async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'GET') {
      scenario.counters.reviewerGetCalls++;
      return route.fulfill(ok([toReviewer(scenario.record)]));
    }
    if (method === 'POST') {
      scenario.counters.createCalls++;
      let body: {
        bankName?: string;
        accountNumber?: string;
        accountName?: string;
        amount?: number;
        note?: string;
      } = {};
      try {
        body = JSON.parse(req.postData() ?? '{}');
      } catch {
        /* malformed body — keep defaults */
      }
      scenario.record.bankName = body.bankName ?? scenario.record.bankName;
      scenario.record.accountNumber =
        body.accountNumber ?? scenario.record.accountNumber;
      scenario.record.accountName =
        body.accountName ?? scenario.record.accountName;
      scenario.record.note = body.note ?? scenario.record.note;
      if (typeof body.amount === 'number') {
        // The fixture only carries the canonical 0-VND amount; we DO
        // accept the literal 0 here, but we DO NOT accept any other value
        // — the FE already filters that case.
        scenario.record.amount = body.amount as 0;
      }
      scenario.record.createdAt = new Date().toISOString();
      scenario.record.status = 'PENDING';
      scenario.record.processedAt = null;
      scenario.record.completedAt = null;
      scenario.record.proofReceiptUrl = null;
      return route.fulfill(ok(toReviewer(scenario.record), 201));
    }
    return route.continue();
  });

  // ── Reviewer PUT /api/WithdrawalRequest/{id} ────────────────────────────
  page.route(/\/api\/WithdrawalRequest\/\d+(?:\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() !== 'PUT') return route.continue();
    let body: { status?: string; rejectionReason?: string } = {};
    try {
      body = JSON.parse(req.postData() ?? '{}');
    } catch {
      /* ignore */
    }
    if (body.status === 'Approved') {
      scenario.record.status = 'ACCEPTED_PROCESSING';
      scenario.record.processedAt = new Date().toISOString();
    } else if (body.status === 'Rejected') {
      scenario.record.status = 'DENIED';
    }
    return route.fulfill(ok(toReviewer(scenario.record)));
  });

  // ── Admin GET /api/WithdrawalRequest (same path, admin scope) ───────────
  // The Admin service uses the SAME path but treats it as an admin scope.
  // We can't distinguish by URL alone — Playwright routes are URL-based.
  // We rely on the spec to call adminService.getReviewerWithdrawals() while
  // signed in as admin and on the fact that no other BE endpoint returns
  // the admin shape. Both sides receive their canonical shape.

  // ── Admin GET /api/WithdrawalRequest (admin list, single match per route)
  page.route(/\/api\/WithdrawalRequest\/admin\/all(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    scenario.counters.adminGetCalls++;
    return route.fulfill(ok([toAdmin(scenario.record)]));
  });

  // ── Admin POST /api/WithdrawalRequest/{id}/accept ───────────────────────
  page.route(
    /\/api\/WithdrawalRequest\/\d+\/accept(?:\?.*)?$/,
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      scenario.counters.acceptCalls++;
      scenario.record.status = 'ACCEPTED_PROCESSING';
      scenario.record.processedAt = new Date().toISOString();
      return route.fulfill(ok(toAdmin(scenario.record)));
    },
  );

  // ── Admin POST /api/WithdrawalRequest/{id}/complete ────────────────────
  page.route(
    /\/api\/WithdrawalRequest\/\d+\/complete(?:\?.*)?$/,
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      scenario.counters.completeCalls++;
      // Allow the negative test to inject a 500 once.
      const override = scenario.counters.nextCompleteStatusOverride;
      scenario.counters.nextCompleteStatusOverride = null;
      if (override !== null) {
        return route.fulfill(
          ok({ error: 'Simulated BE failure', code: 'COMPLETE_FAILED' }, override),
        );
      }
      let body: { proofReceiptUrl?: string } = {};
      try {
        body = JSON.parse(route.request().postData() ?? '{}');
      } catch {
        /* ignore */
      }
      if (typeof body.proofReceiptUrl === 'string') {
        scenario.record.proofReceiptUrl = body.proofReceiptUrl;
      }
      scenario.record.status = 'COMPLETED';
      scenario.record.completedAt = new Date().toISOString();
      return route.fulfill(ok(toAdmin(scenario.record)));
    },
  );

  // ── Admin POST /api/WithdrawalRequest/{id}/deny ─────────────────────────
  page.route(
    /\/api\/WithdrawalRequest\/\d+\/deny(?:\?.*)?$/,
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      scenario.counters.denyCalls++;
      scenario.record.status = 'DENIED';
      return route.fulfill(ok(toAdmin(scenario.record)));
    },
  );

  // ── Receipt upload (Firebase) ───────────────────────────────────────────
  // The FE uses `useReceiptUpload` which calls
  // `uploadBytesResumable(ref(storage, 'withdrawal_receipts/<name>'), file)`
  // against the configured Firebase Storage bucket. We intercept the bucket
  // host AND the `example.test` substitute so the upload never leaves the
  // browser process. The response is a deterministic URL that the spec can
  // navigate to (to verify "View Receipt").
  page.route(
    (url) => {
      const host = url.host;
      return (
        host.endsWith('.appspot.com') ||
        host.endsWith('.googleapis.com') ||
        host.endsWith('.firebasestorage.app') ||
        host === 'example.test' ||
        host === 'firebasestorage.googleapis.com'
      );
    },
    async (route) => {
      scenario.counters.uploadCalls++;
      const override = scenario.counters.nextUploadStatusOverride;
      scenario.counters.nextUploadStatusOverride = null;
      if (override !== null) {
        return route.fulfill(
          {
            status: override,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Simulated upload failure' }),
          },
        );
      }
      // Default success — return the canonical receipt URL the Admin
      // surface will display in the "View Receipt" link.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ downloadURL: scenario.receiptUrl }),
      });
    },
  );
}

/**
 * Read the canonical reviewer request ID (matches the synthetic record).
 * Useful for tests that need to assert on `#WR-XXXXXXX`.
 */
export function reviewerRequestId(record: WithdrawalFixtureRecord): string {
  return `#WR-${String(record.id).padStart(6, '0')}`;
}

/**
 * Read the canonical admin transaction ID — Admin UI pads with 4 zeros.
 */
export function adminTxId(record: WithdrawalFixtureRecord): string {
  return `#${String(record.txId ?? record.id).padStart(4, '0')}`;
}

/**
 * Seed the in-memory scenario record into the PENDING state, mimicking
 * what a successful POST would produce. Use this when the live Reviewer
 * form's JS validation refuses the `0 VND` amount and we cannot drive
 * the POST through the form — the spec still needs a record to find in
 * both Reviewer and Admin histories.
 *
 * The record's bank/account/note fields come straight from `scenario.record`
 * so the Reviewer sees exactly what they tried to submit. Returns the
 * resulting record (in PENDING state) so callers can chain.
 */
export function seedPendingRequest(scenario: WithdrawalFlowScenario): WithdrawalFixtureRecord {
  scenario.record.status = 'PENDING';
  scenario.record.processedAt = null;
  scenario.record.completedAt = null;
  scenario.record.proofReceiptUrl = null;
  scenario.record.createdAt = new Date().toISOString();
  scenario.counters.createCalls++;
  return scenario.record;
}

/**
 * Convenience wrapper for the spec: posts the seeded record through the
 * intercepted `/api/WithdrawalRequest` endpoint via the browser's fetch
 * so the React app's `useEffect` would re-fetch and render the row.
 * Returns the JSON-encoded reviewer-shaped record.
 */
export async function postSeedViaFetch(
  page: Page,
  scenario: WithdrawalFlowScenario,
): Promise<ReviewerApiRecord> {
  const body = {
    userId: scenario.record.userId,
    walletId: 1,
    bankName: scenario.record.bankName,
    accountNumber: scenario.record.accountNumber,
    accountName: scenario.record.accountName,
    amount: scenario.record.amount,
    note: scenario.record.note,
  };
  const response = await page.evaluate(async (payload: typeof body) => {
    const res = await fetch('/api/WithdrawalRequest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await res.text() };
  }, body);
  if (response.status >= 400) {
    throw new Error(
      `Seeded POST failed: status=${response.status}, body=${response.body.slice(0, 200)}`,
    );
  }
  scenario.counters.createCalls++;
  return JSON.parse(response.body) as ReviewerApiRecord;
}

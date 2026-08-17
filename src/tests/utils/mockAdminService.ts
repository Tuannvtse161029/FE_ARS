/**
 * Test factory for the admin surface.
 *
 * Two consumers exist:
 *   1. The Admin tests need a controlled copy of the role-request + withdrawal
 *      fixtures so they can assert status changes / view details without
 *      fighting the shared mock store's `MOCK_LATENCY_MS` delay or in-memory
 *      mutation that other tests in the same file may have already applied.
 *   2. The tests need to drop the production services in favour of
 *      `vi.mock('../../services/admin.service', …)` so the modal confirm
 *      button wires straight to our local spy.
 *
 * Usage:
 *
 *   import { buildMockAdminService, mockAdminFixtures } from '../utils/mockAdminService';
 *
 *   vi.mock('../../services/admin.service', () => ({
 *     adminService: buildMockAdminService(),
 *   }));
 */
import { vi } from 'vitest';
import type {
  RoleRequest,
  RoleRequestDecision,
  WithdrawalRequestItem,
} from '../../types/admin';

// ── Fixture builders ───────────────────────────────────────────────────────

const NOW = '2026-08-16T10:30:00Z';

export const mockAdminFixtures = () => {
  const pendingRole: RoleRequest = {
    id: 9001,
    userId: 501,
    userName: 'Tran Van Khanh',
    email: 'khanh.tran@example.com',
    phone: '+84 901 000 001',
    affiliation: 'VNU University of Science',
    department: 'Computer Science',
    currentRoles: ['RESEARCHER'],
    requestedAdditionalRoles: ['REVIEWER'],
    requestType: 'ADDITIONAL_ROLE',
    proofDocumentUrl: 'https://example.com/proof-khanh.pdf',
    submissionDate: NOW,
    status: 'PENDING',
  };
  const pendingInitial: RoleRequest = {
    id: 9002,
    userId: 502,
    userName: 'Le Thi Lan',
    email: 'lan.le@example.com',
    phone: '+84 901 000 002',
    affiliation: 'HUST',
    department: 'Information Technology',
    currentRoles: [],
    requestedAdditionalRoles: ['LECTURER'],
    requestType: 'INITIAL_REGISTRATION',
    proofDocumentUrl: 'https://example.com/proof-lan.pdf',
    submissionDate: NOW,
    status: 'PENDING',
  };
  const pendingMultiRole: RoleRequest = {
    id: 9003,
    userId: 503,
    userName: 'Pham Hoai Nam',
    email: 'nam.pham@example.com',
    phone: '+84 901 000 003',
    affiliation: 'HCMUS',
    department: 'Mathematics',
    currentRoles: ['RESEARCHER'],
    requestedAdditionalRoles: ['REVIEWER', 'LECTURER'],
    requestType: 'ADDITIONAL_ROLE',
    proofDocumentUrl: 'https://example.com/proof-nam.pdf',
    submissionDate: NOW,
    status: 'PENDING',
  };
  const approvedRole: RoleRequest = {
    id: 9004,
    userId: 504,
    userName: 'Doe Approved',
    email: 'approved@example.com',
    affiliation: 'VNU',
    department: 'Physics',
    currentRoles: ['REVIEWER'],
    requestedAdditionalRoles: ['RESEARCHER'],
    requestType: 'ADDITIONAL_ROLE',
    proofDocumentUrl: 'https://example.com/proof-approved.pdf',
    submissionDate: NOW,
    status: 'APPROVED',
    notes: 'Verified by admin',
  };
  const deniedRole: RoleRequest = {
    id: 9005,
    userId: 505,
    userName: 'Vu Denied',
    email: 'denied@example.com',
    affiliation: 'VNU',
    department: 'Chemistry',
    currentRoles: ['GRADUATE_STUDENT'],
    requestedAdditionalRoles: ['RESEARCHER'],
    requestType: 'ADDITIONAL_ROLE',
    proofDocumentUrl: 'https://example.com/proof-denied.pdf',
    submissionDate: NOW,
    status: 'DENIED',
    notes: 'Proof document was a CV, not a research focus statement.',
  };

  const pendingWithdrawal: WithdrawalRequestItem = {
    txId: 8001,
    userId: 601,
    reviewerName: 'Nguyen Van Pending',
    amountVnd: 2_500_000,
    currency: 'VND',
    bankName: 'Vietcombank',
    accountNumber: '1029 7482 11',
    accountName: 'NGUYEN VAN PENDING',
    requestDate: NOW,
    status: 'PENDING',
    proofReceiptUrl: null,
  };
  const processingWithdrawal: WithdrawalRequestItem = {
    txId: 8002,
    userId: 602,
    reviewerName: 'Tran Thi Processing',
    amountVnd: 1_750_000,
    currency: 'VND',
    bankName: 'Techcombank',
    accountNumber: '1903 4500 22',
    accountName: 'TRAN THI PROCESSING',
    requestDate: NOW,
    status: 'ACCEPTED_PROCESSING',
    processingAt: NOW,
    proofReceiptUrl: null,
  };
  const completedWithdrawal: WithdrawalRequestItem = {
    txId: 8003,
    userId: 603,
    reviewerName: 'Bui Thi Completed',
    amountVnd: 4_200_000,
    currency: 'VND',
    bankName: 'BIDV',
    accountNumber: '5611 0099 33',
    accountName: 'BUI THI COMPLETED',
    requestDate: NOW,
    status: 'COMPLETED',
    processingAt: NOW,
    completedAt: NOW,
    proofReceiptUrl: 'https://firebasestorage.googleapis.com/v0/b/ars-platform/o/receipt.pdf',
  };
  const deniedWithdrawal: WithdrawalRequestItem = {
    txId: 8004,
    userId: 604,
    reviewerName: 'Vu Thi Denied',
    amountVnd: 950_000,
    currency: 'VND',
    bankName: 'ACB',
    accountNumber: '1234 5678 44',
    accountName: 'VU THI DENIED',
    requestDate: NOW,
    status: 'DENIED',
    proofReceiptUrl: null,
    rejectionReason: 'Bank account name does not match registered KYC name.',
  };

  return {
    pendingRole,
    pendingInitial,
    pendingMultiRole,
    approvedRole,
    deniedRole,
    pendingWithdrawal,
    processingWithdrawal,
    completedWithdrawal,
    deniedWithdrawal,
  };
};

// ── Service factory ────────────────────────────────────────────────────────

export interface MockAdminServiceOptions {
  roleRequests?: RoleRequest[];
  withdrawals?: WithdrawalRequestItem[];
  /** When set, `decideRoleRequest` rejects with this error. */
  decideShouldFail?: Error | null;
  /** When set, `markWithdrawalProcessing` rejects with this error. */
  markProcessingShouldFail?: Error | null;
  /** When set, `completeWithdrawal` rejects with this error. */
  completeShouldFail?: Error | null;
  /** When set, `denyWithdrawal` rejects with this error. */
  denyShouldFail?: Error | null;
}

export const buildMockAdminService = (options: MockAdminServiceOptions = {}) => {
  const fixtures = mockAdminFixtures();
  const requests: RoleRequest[] = options.roleRequests ?? [
    fixtures.pendingRole,
    fixtures.pendingInitial,
    fixtures.pendingMultiRole,
    fixtures.approvedRole,
    fixtures.deniedRole,
  ];
  const withdrawals: WithdrawalRequestItem[] = options.withdrawals ?? [
    fixtures.pendingWithdrawal,
    fixtures.processingWithdrawal,
    fixtures.completedWithdrawal,
    fixtures.deniedWithdrawal,
  ];

  const getRoleRequests = vi.fn(async () => requests.map((r) => ({ ...r })));
  const getRoleRequest = vi.fn(async (id: number) => {
    const hit = requests.find((r) => r.id === id);
    return hit ? { ...hit } : null;
  });
  const decideRoleRequest = vi.fn(
    async (id: number, decision: RoleRequestDecision) => {
      if (options.decideShouldFail) throw options.decideShouldFail;
      const idx = requests.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Role request ${id} not found`);
      const updated: RoleRequest = { ...requests[idx], ...decision };
      requests[idx] = updated;
      return { ...updated };
    },
  );

  const getReviewerWithdrawals = vi.fn(async () =>
    withdrawals.map((w) => ({ ...w })),
  );
  const markWithdrawalProcessing = vi.fn(async (id: number) => {
    if (options.markProcessingShouldFail) throw options.markProcessingShouldFail;
    const idx = withdrawals.findIndex((w) => w.txId === id);
    if (idx === -1) throw new Error(`Withdrawal ${id} not found`);
    const updated: WithdrawalRequestItem = {
      ...withdrawals[idx],
      status: 'ACCEPTED_PROCESSING',
      processingAt: new Date().toISOString(),
    };
    withdrawals[idx] = updated;
    return { ...updated };
  });
  const completeWithdrawal = vi.fn(
    async (
      id: number,
      proofReceiptUrl: string,
      _reviewerId: number,
      _reviewerName: string,
      _amountVnd: number,
    ) => {
      if (options.completeShouldFail) throw options.completeShouldFail;
      const idx = withdrawals.findIndex((w) => w.txId === id);
      if (idx === -1) throw new Error(`Withdrawal ${id} not found`);
      const updated: WithdrawalRequestItem = {
        ...withdrawals[idx],
        status: 'COMPLETED',
        proofReceiptUrl,
        completedAt: new Date().toISOString(),
      };
      withdrawals[idx] = updated;
      return { ...updated };
    },
  );
  const denyWithdrawal = vi.fn(async (id: number, reason: string) => {
    if (options.denyShouldFail) throw options.denyShouldFail;
    const idx = withdrawals.findIndex((w) => w.txId === id);
    if (idx === -1) throw new Error(`Withdrawal ${id} not found`);
    const updated: WithdrawalRequestItem = {
      ...withdrawals[idx],
      status: 'DENIED',
      rejectionReason: reason,
    };
    withdrawals[idx] = updated;
    return { ...updated };
  });

  return {
    adminService: {
      getRoleRequests,
      getRoleRequest,
      decideRoleRequest,
      getAccounts: vi.fn(async () => []),
      suspendAccount: vi.fn(async () => ({} as never)),
      unsuspendAccount: vi.fn(async () => ({} as never)),
      getReviewerWithdrawals,
      markWithdrawalProcessing,
      completeWithdrawal,
      denyWithdrawal,
      getAnalyticsSummary: vi.fn(async () => ({
        totalMembers: 0,
        totalPapers: 0,
      })),
      getAnalyticsTimeseries: vi.fn(async () => ({
        range: 'daily' as const,
        metric: 'revenue' as const,
        points: [],
      })),
      __resetAdminMockStores: vi.fn(),
    },
    // Exposed for callers that want to inspect the fixture state directly.
    _internal: {
      requests,
      withdrawals,
    },
  };
};
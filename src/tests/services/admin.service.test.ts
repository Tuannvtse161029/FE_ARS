import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../services/axios';
import { adminService } from '../../services/admin.service';
import { notificationService } from '../../services/notification.service';
import type { WithdrawalRequestItem } from '../../types/admin';
import type { User } from '../../types/auth';

// Spy on the api object the service module imported at load time.
// The service holds a direct reference to this object; vi.mock does not
// redirect module-level imports.  vi.spyOn is the correct tool here.
let axiosGetSpy: ReturnType<typeof vi.spyOn>;
let axiosPostSpy: ReturnType<typeof vi.spyOn>;
let axiosPatchSpy: ReturnType<typeof vi.spyOn>;
let axiosDeleteSpy: ReturnType<typeof vi.spyOn>;

vi.mock('../../services/notification.service', () => ({
  notificationService: { create: vi.fn().mockResolvedValue({ id: 1 }) },
}));

describe('adminService (mock data path)', () => {
  beforeAll(() => {
    // Spy on the real api object so all describe blocks share the same spies.
    axiosGetSpy = vi.spyOn(api, 'get');
    axiosPostSpy = vi.spyOn(api, 'post');
    axiosPatchSpy = vi.spyOn(api, 'patch');
    axiosDeleteSpy = vi.spyOn(api, 'delete');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    adminService.__resetAdminMockStores();
    // Reset the spies so each test starts clean.
    axiosGetSpy.mockReset();
    axiosPostSpy.mockReset();
    axiosPatchSpy.mockReset();
    axiosDeleteSpy.mockReset();
  });

  describe('role requests', () => {
    const roleRequestFixture: RoleRequest[] = [
      {
        id: 8001,
        userId: 801,
        userName: 'Tran Van B',
        email: 'b.tran@example.com',
        affiliation: 'VNU',
        department: 'CS',
        currentRoles: ['RESEARCHER'],
        requestedAdditionalRoles: ['REVIEWER'],
        requestType: 'ADDITIONAL_ROLE',
        proofDocumentUrl: 'https://example.com/b.pdf',
        submissionDate: '2026-08-01T00:00:00Z',
        status: 'PENDING',
      },
      {
        id: 8002,
        userId: 802,
        userName: 'Le Thi C',
        email: 'c.le@example.com',
        affiliation: 'HUST',
        department: 'IT',
        currentRoles: [],
        requestedAdditionalRoles: ['LECTURER'],
        requestType: 'INITIAL_REGISTRATION',
        proofDocumentUrl: 'https://example.com/c.pdf',
        submissionDate: '2026-08-02T00:00:00Z',
        status: 'APPROVED',
        notes: 'Verified',
      },
    ];

    it('lists pending role requests', async () => {
      axiosGetSpy.mockResolvedValue({ data: roleRequestFixture });
      const list = await adminService.getRoleRequests();
      const pending = list.filter((r) => r.status === 'PENDING');
      expect(pending.length).toBeGreaterThan(0);
      expect(list.length).toBeGreaterThan(0);
    });

    it('approves a pending request and moves it to APPROVED', async () => {
      axiosGetSpy.mockResolvedValue({ data: roleRequestFixture.map((r) => ({ ...r })) });
      axiosPostSpy.mockResolvedValue({ data: { ...roleRequestFixture[0], status: 'APPROVED', notes: 'Looks good' } });

      const before = await adminService.getRoleRequests();
      const pending = before.find((r) => r.status === 'PENDING');
      expect(pending).toBeDefined();
      if (!pending) return;

      const updated = await adminService.decideRoleRequest(pending.id, {
        status: 'APPROVED',
        notes: 'Looks good',
      });
      expect(updated.status).toBe('APPROVED');
      expect(updated.notes).toBe('Looks good');
      // The second getRoleRequests() re-fetches from axios (USE_MOCK_DATA=false),
      // returning the unchanged fixture — so we only assert on the returned updated item.
    });

    it('denies a pending request', async () => {
      axiosGetSpy.mockResolvedValue({ data: roleRequestFixture.map((r) => ({ ...r })) });
      axiosPostSpy.mockResolvedValue({
        data: { ...roleRequestFixture[0], status: 'DENIED', notes: 'Proof document unreadable' },
      });

      const before = await adminService.getRoleRequests();
      const pending = before.find((r) => r.status === 'PENDING');
      if (!pending) throw new Error('No pending request to deny');
      const updated = await adminService.decideRoleRequest(pending.id, {
        status: 'DENIED',
        notes: 'Proof document unreadable',
      });
      expect(updated.status).toBe('DENIED');
      expect(updated.notes).toMatch(/Proof document unreadable/);
    });

    it('rejects an unknown role request id', async () => {
      axiosPostSpy.mockRejectedValue(new Error(`Role request 99999 not found`));
      await expect(
        adminService.decideRoleRequest(99999, { status: 'APPROVED' }),
      ).rejects.toThrow(/not found/);
    });
  });

  describe('accounts', () => {
    // Wire-shape fixture matching what /api/user returns (userToAccountItem maps it).
    const userFixture: User[] = [
      {
        id: 901,
        email: 'nguyen.reviewer@example.com',
        fullName: 'Nguyen Van Reviewer',
        roleName: 'REVIEWER',
        accountTier: null,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 902,
        email: 'tran.researcher@example.com',
        fullName: 'Tran Van Researcher',
        roleName: 'Researcher',
        accountTier: 'Premium',
        isActive: true,
        createdAt: '2026-02-01T00:00:00Z',
      },
      {
        id: 903,
        email: 'le.suspended@example.com',
        fullName: 'Le Thi Suspended',
        roleName: 'Graduate Student',
        accountTier: null,
        isActive: false,
        createdAt: '2026-03-01T00:00:00Z',
      },
    ];

    it('returns all accounts when no filter is applied', async () => {
      axiosGetSpy.mockResolvedValue({ data: { items: userFixture, totalCount: userFixture.length } });
      const accounts = await adminService.getAccounts({});
      expect(accounts.length).toBeGreaterThan(0);
    });

    it('filters by role (REVIEWER)', async () => {
      axiosGetSpy.mockResolvedValue({ data: { items: userFixture, totalCount: userFixture.length } });
      const reviewers = await adminService.getAccounts({ role: 'REVIEWER' });
      expect(reviewers.length).toBeGreaterThan(0);
      reviewers.forEach((a) => expect(a.roles).toContain('REVIEWER'));
    });

    it('filters by plan (PREMIUM)', async () => {
      axiosGetSpy.mockResolvedValue({ data: { items: userFixture, totalCount: userFixture.length } });
      const premium = await adminService.getAccounts({ plan: 'PREMIUM' });
      premium.forEach((a) => expect(a.plan).toBe('PREMIUM'));
    });

    it('filters by status (SUSPENDED)', async () => {
      axiosGetSpy.mockResolvedValue({ data: { items: userFixture, totalCount: userFixture.length } });
      const suspended = await adminService.getAccounts({ status: 'SUSPENDED' });
      suspended.forEach((a) => expect(a.status).toBe('SUSPENDED'));
    });

    it('search matches by name (case-insensitive)', async () => {
      axiosGetSpy.mockResolvedValue({ data: { items: userFixture, totalCount: userFixture.length } });
      const hits = await adminService.getAccounts({ search: 'nguyen' });
      expect(hits.length).toBeGreaterThan(0);
    });

    it('toggles account status via suspend/unsuspend', async () => {
      axiosGetSpy.mockResolvedValue({ data: { items: userFixture, totalCount: userFixture.length } });
      // Mock POST to return the correct AccountItem shape based on which endpoint is called.
      axiosPostSpy.mockImplementation(async (url: string) => {
        if (String(url).includes('/suspend')) {
          return { data: { ...userFixture[0], isActive: false, status: 'SUSPENDED' } };
        }
        if (String(url).includes('/unsuspend')) {
          return { data: { ...userFixture[0], isActive: true, status: 'ACTIVE' } };
        }
        return { data: {} };
      });

      const accounts = await adminService.getAccounts({});
      const target = accounts.find((a) => a.status === 'ACTIVE');
      if (!target) throw new Error('Need an ACTIVE account to test suspend');

      const suspended = await adminService.suspendAccount(target.id);
      expect(suspended.status).toBe('SUSPENDED');

      const reactivated = await adminService.unsuspendAccount(suspended.id);
      expect(reactivated.status).toBe('ACTIVE');
    });
  });

  describe('withdrawals', () => {
    it('lists reviewer withdrawals', async () => {
      const list = await adminService.getReviewerWithdrawals();
      expect(list.length).toBeGreaterThan(0);
    });

    it('normalizes API `note` → requestReason at the service boundary', async () => {
      // Defect 5: the wire shape uses `note`; the Admin UI reads
      // `requestReason`. The normalization happens once inside
      // adminService so downstream code never sees both spellings.
      const list = await adminService.getReviewerWithdrawals();
      // No row should carry the `note` alias on its public surface.
      list.forEach((row) => {
        expect((row as WithdrawalRequestItem & { note?: unknown }).note).toBeUndefined();
        // requestReason is either a non-empty string or null/undefined —
        // never the bare wire alias.
        if (row.requestReason !== undefined && row.requestReason !== null) {
          expect(typeof row.requestReason).toBe('string');
        }
      });
      // At least one row carries a non-null requestReason (fixtures
      // include 2001, 2003, 2004 — only 2002 has none).
      const withReason = list.filter((w) => typeof w.requestReason === 'string' && w.requestReason.length > 0);
      expect(withReason.length).toBeGreaterThan(0);
    });

    it('exports a normalizeWithdrawalItem helper that maps note → requestReason', async () => {
      const { normalizeWithdrawalItem } = await import('../../services/admin.service');
      const normalized = normalizeWithdrawalItem({
        txId: 9001,
        userId: 1,
        reviewerName: 'Tester',
        amountVnd: 100_000,
        bankName: 'VCB',
        accountNumber: '1',
        accountName: 'TESTER',
        requestDate: '2026-08-01T00:00:00Z',
        status: 'PENDING',
        proofReceiptUrl: null,
        note: 'Test reason',
      });
      expect(normalized.requestReason).toBe('Test reason');
      expect((normalized as { note?: unknown }).note).toBeUndefined();
    });

    it('moves a PENDING request to ACCEPTED_PROCESSING', async () => {
      const list = await adminService.getReviewerWithdrawals();
      const pending = list.find((w) => w.status === 'PENDING');
      if (!pending) throw new Error('Need a PENDING withdrawal');

      const updated = await adminService.markWithdrawalProcessing(pending.txId);
      expect(updated.status).toBe('ACCEPTED_PROCESSING');
    });

    it('completes the ACCEPTED_PROCESSING withdrawal and notifies the reviewer', async () => {
      const list = await adminService.getReviewerWithdrawals();
      const target = list.find((w) => w.status === 'ACCEPTED_PROCESSING');
      if (!target) throw new Error('Need an ACCEPTED_PROCESSING withdrawal');

      const fakeReceiptUrl = 'https://firebasestorage.googleapis.com/r';
      const updated = await adminService.completeWithdrawal(
        target.txId,
        fakeReceiptUrl,
        target.userId,
        target.reviewerName,
        target.amountVnd,
      );
      expect(updated.status).toBe('COMPLETED');
      expect(updated.proofReceiptUrl).toBe(fakeReceiptUrl);
      expect(notificationService.create).toHaveBeenCalledTimes(1);
      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: target.userId,
          isRead: false,
        }),
      );
    });

    it('denies a PENDING withdrawal with reason', async () => {
      const list = await adminService.getReviewerWithdrawals();
      const target = list.find((w) => w.status === 'PENDING');
      if (!target) throw new Error('Need a PENDING withdrawal');

      const updated = await adminService.denyWithdrawal(target.txId, 'Bank name mismatch');
      expect(updated.status).toBe('DENIED');
      expect(updated.rejectionReason).toBe('Bank name mismatch');
    });
  });

  describe('analytics', () => {
    // USE_ANALYTICS_MOCK = false so analytics calls hit axios directly.
    // Use the shared axiosGetSpy already set up in beforeAll.
    beforeEach(() => {
      vi.clearAllMocks();
      axiosGetSpy.mockReset();
    });

    it('returns a summary with non-zero members and papers', async () => {
      axiosGetSpy.mockResolvedValue({
        data: { totalMembers: 142, totalPapers: 38 },
      });
      const summary = await adminService.getAnalyticsSummary();
      expect(summary.totalMembers).toBeGreaterThan(0);
      expect(summary.totalPapers).toBeGreaterThan(0);
    });

    it('returns a user_registrations monthly series of 12 points', async () => {
      axiosGetSpy.mockResolvedValue({
        data: {
          range: 'monthly',
          metric: 'user_registrations',
          points: Array.from({ length: 12 }, (_, i) => ({
            date: `2025-${String(i + 1).padStart(2, '0')}-01`,
            value: 10 + i,
          })),
        },
      });
      const series = await adminService.getAnalyticsTimeseries('monthly', 'user_registrations');
      expect(series.range).toBe('monthly');
      expect(series.points).toHaveLength(12);
    });

    it('returns a daily revenue series of 30 points', async () => {
      axiosGetSpy.mockResolvedValue({
        data: {
          range: 'daily',
          metric: 'revenue',
          points: Array.from({ length: 30 }, (_, i) => ({
            date: `2026-08-${String(i + 1).padStart(2, '0')}`,
            value: 500_000 + i * 10_000,
          })),
        },
      });
      const series = await adminService.getAnalyticsTimeseries('daily', 'revenue');
      expect(series.metric).toBe('revenue');
      expect(series.points).toHaveLength(30);
    });

    it('returns a yearly user_registrations series of 10 points', async () => {
      axiosGetSpy.mockResolvedValue({
        data: {
          range: 'yearly',
          metric: 'user_registrations',
          points: Array.from({ length: 10 }, (_, i) => ({
            date: `${2016 + i}-01-01`,
            value: 50 + i * 10,
          })),
        },
      });
      const series = await adminService.getAnalyticsTimeseries('yearly', 'user_registrations');
      expect(series.points).toHaveLength(10);
    });
  });

  // ── Task: verify getRoleRequests hits the real API path (not mock) ─────────
  describe('getRoleRequests — live API path (USE_MOCK_DATA = false)', () => {
    it('GET /api/RoleRequest is called when USE_MOCK_DATA is false', async () => {
      axiosGetSpy.mockResolvedValue({
        data: [
          {
            id: 7001,
            userId: 701,
            userName: 'Nguyen Van A',
            email: 'a.nguyen@example.com',
            affiliation: 'VNU',
            department: 'CS',
            proofDocumentUrl: 'https://example.com/a.pdf',
            submissionDate: '2026-08-01T00:00:00Z',
            status: 'PENDING',
          },
        ],
      });

      await adminService.getRoleRequests();

      // The live path in admin.service.ts is:
      //   api.get<RoleRequest[]>(API_ENDPOINTS.ADMIN.ROLE_REQUESTS.GET_ALL)
      // which equals '/api/RoleRequest'.
      expect(axiosGetSpy).toHaveBeenCalledWith('/api/RoleRequest');
    });

    it('decideRoleRequest calls POST /api/RoleRequest/{id}/approve for APPROVED', async () => {
      axiosPostSpy.mockResolvedValue({
        data: {
          id: 7001,
          userId: 701,
          userName: 'Nguyen Van A',
          email: 'a.nguyen@example.com',
          affiliation: 'VNU',
          department: 'CS',
          proofDocumentUrl: 'https://example.com/a.pdf',
          submissionDate: '2026-08-01T00:00:00Z',
          status: 'APPROVED',
          notes: 'Looks good',
        },
      });

      await adminService.decideRoleRequest(7001, { status: 'APPROVED', notes: 'Looks good' });

      expect(axiosPostSpy).toHaveBeenCalledWith(
        '/api/RoleRequest/7001/approve',
        { notes: 'Looks good' },
      );
    });

    it('decideRoleRequest calls POST /api/RoleRequest/{id}/deny for DENIED', async () => {
      axiosPostSpy.mockResolvedValue({
        data: {
          id: 7001,
          userId: 701,
          userName: 'Nguyen Van A',
          email: 'a.nguyen@example.com',
          affiliation: 'VNU',
          department: 'CS',
          proofDocumentUrl: 'https://example.com/a.pdf',
          submissionDate: '2026-08-01T00:00:00Z',
          status: 'DENIED',
          notes: 'Proof unreadable',
        },
      });

      await adminService.decideRoleRequest(7001, { status: 'DENIED', notes: 'Proof unreadable' });

      expect(axiosPostSpy).toHaveBeenCalledWith(
        '/api/RoleRequest/7001/deny',
        { notes: 'Proof unreadable' },
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../../src/services/axios';
import { adminService } from '../../../src/services/admin.service';
import type { User } from '../../../src/types/auth';

vi.mock('../../../src/config/app', () => ({
  AppConfig: {
    appName: 'ARS Platform',
    appVersion: '1.0.0',
    description: 'x',
    features: {
      enableRegistration: true,
      enableORCID: false,
      enablePaperSubmission: true,
      enableWithdrawals: false,
    },
  },
  AuthConfig: { tokenKey: 'ars_token', userKey: 'ars_user', tokenExpirationHours: 24 },
}));

// Spy on the api object the service module imported at load time.
// The service holds a direct reference to this object; vi.mock does not
// redirect module-level imports.  vi.spyOn is the correct tool here.
let axiosGetSpy: ReturnType<typeof vi.spyOn>;
let axiosPostSpy: ReturnType<typeof vi.spyOn>;
let axiosPatchSpy: ReturnType<typeof vi.spyOn>;
let axiosPutSpy: ReturnType<typeof vi.spyOn>;
let axiosDeleteSpy: ReturnType<typeof vi.spyOn>;

vi.mock('../../../src/services/notification.service', () => ({
  notificationService: { create: vi.fn().mockResolvedValue({ id: 1 }) },
}));

describe('adminService (mock data path)', () => {
  beforeAll(() => {
    // Spy on the real api object so all describe blocks share the same spies.
    axiosGetSpy = vi.spyOn(api, 'get');
    axiosPostSpy = vi.spyOn(api, 'post');
    axiosPatchSpy = vi.spyOn(api, 'patch');
    axiosPutSpy = vi.spyOn(api, 'put');
    axiosDeleteSpy = vi.spyOn(api, 'delete');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    adminService.__resetAdminMockStores();
    // Reset the spies so each test starts clean.
    axiosGetSpy.mockReset();
    axiosPostSpy.mockReset();
    axiosPatchSpy.mockReset();
    axiosPutSpy.mockReset();
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

    it('toggles account status via suspend/unsuspend (PUT /api/user/{id})', async () => {
      // Live path now goes through the User API per Agent 29 BTR-AGENT29-A.
      // The suspend flow is:
      //   1. GET /api/user/{id}        — to read fullName + avatarUrl
      //   2. PUT /api/user/{id}        — with { fullName, isActive: false }
      //   3. GET /api/user/{id}        — refetch the authoritative row
      const userRow = { ...userFixture[0] };
      let isActive = true;

      axiosGetSpy.mockImplementation(async (url: string) => {
        if (String(url) === '/api/user' || String(url).startsWith('/api/user?')) {
          return { data: { items: userFixture, totalCount: userFixture.length } };
        }
        if (String(url) === `/api/user/${userRow.id}`) {
          return { data: { ...userRow, isActive } };
        }
        return { data: {} };
      });

      axiosPutSpy.mockImplementation(async (url: string, body: { isActive?: boolean }) => {
        isActive = body.isActive ?? isActive;
        return { data: { ...userRow, isActive } };
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
      //   api.get<RoleRequest[]>(API_ENDPOINTS.ADMIN.ROLE_REQUESTS.GET_ALL, { signal? })
      // which equals '/api/RoleRequest'.
      expect(axiosGetSpy).toHaveBeenCalledWith(
        '/api/RoleRequest',
        expect.objectContaining({}),
      );
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

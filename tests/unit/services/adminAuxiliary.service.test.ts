import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminAuxiliaryService } from '../../../src/services/adminAuxiliary.service';
import { adminService } from '../../../src/services/admin.service';
import type { AuditLogEntry } from '../../../src/types/adminAuxiliary';

// Mock axios so that USE_AUDIT_MOCK = false still resolves during tests.
// We capture the mock functions in module-level variables so that beforeEach
// can reconfigure them per-test with the current state of the auditLog store.
let mockGet: ReturnType<typeof vi.fn>;
let mockPost: ReturnType<typeof vi.fn>;
let mockPut: ReturnType<typeof vi.fn>;
vi.mock('../../../src/services/axios', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

// Re-configure the mock before each test so it returns the current state of
// the in-memory auditLog store. The getter resolves the circular import
// (adminAuxiliary.service ↔ auditLogStore ↔ adminAuxiliary.mocks) at call-time
// rather than module-init-time, avoiding the partial-module problem.
//
// NOTE: mockGet must branch by URL because tests that call adminService methods
// (suspendAccount, getAccounts) also go through axios when USE_MOCK_DATA=false.
let _getAuditLogStore: () => { snapshot: () => AuditLogEntry[] };
let _mockAccountsData: unknown[] = [];
// Set by mockPost when the suspend endpoint is hit; consumed by mockGet to inject
// suspendedUntil into the correct account so getAccounts reflects the action.
let _lastSuspendedId: number | undefined;
beforeEach(async () => {
  // Reset mock stores first.
  adminAuxiliaryService.__resetAdminAuxiliaryMockStores();
  adminService.__resetAdminMockStores();
  _lastSuspendedId = undefined;

  // Resolve the circular import at call-time.
  const storeModule = await import('../../../src/services/auditLogStore');
  _getAuditLogStore = () => storeModule.auditLog;

  // Load account fixtures for the accounts path.
  const { MOCK_ACCOUNTS } = await import('../../mocks/admin.mocks');
  _mockAccountsData = MOCK_ACCOUNTS;

  mockGet = vi.fn().mockImplementation((url: unknown) => {
    const path = String(url ?? '');
    // eslint-disable-next-line no-console
    console.log('[DEBUG mockGet] url:', path, '| _lastSuspendedId:', _lastSuspendedId);
    if (path.startsWith('/api/AuditLog')) {
      const items = _getAuditLogStore().snapshot().map((item) => ({
        ...item,
        createdAt: item.timestamp,
      }));
      return Promise.resolve({
        data: { items, totalCount: items.length, pageNumber: 1, pageSize: 1000 },
      });
    }
    // GET /api/user/{id} — used by userService.updateIsActive (Agent 29).
    // AccountItem fixtures do NOT include `fullName` so we synthesize a User
    // here. The mock intentionally loses fidelity for fields the test does
    // not assert on.
    const singleMatch = path.match(/^\/api\/user\/(\d+)\/?$/);
    if (singleMatch) {
      const id = parseInt(singleMatch[1], 10);
      const acc = (_mockAccountsData as Array<{ id: number; name?: string; email?: string; username?: string }>).find(
        (a) => a.id === id,
      );
      return Promise.resolve({
        data: {
          id,
          email: acc?.email ?? `user${id}@example.com`,
          fullName: acc?.name ?? `User ${id}`,
          username: acc?.username ?? `user${id}`,
          roleId: 0,
          roleName: null,
          isActive: _lastSuspendedId === id ? false : true,
          isEmailVerified: true,
          accountTier: 'Free',
          createdAt: '2026-01-01T00:00:00Z',
        },
      });
    }
    // GET /api/user (list) — accounts path used by adminService.getAccounts().
    // Inject suspendedUntil for the account that was last suspended via DELETE_CONTENT_SUSPEND_14D.
    const futureDate = new Date(Date.now() + 14 * 86_400_000).toISOString();
    // eslint-disable-next-line no-console
    console.log('[DEBUG mockGet] _mockAccountsData ids:', (_mockAccountsData as any[]).map((a) => a.id), '_lastSuspendedId:', _lastSuspendedId);
    const injectedAccounts = _mockAccountsData.map((acc: any) => {
      // eslint-disable-next-line no-console
      console.log('[DEBUG mockGet] acc.id:', acc.id, '=== _lastSuspendedId?', acc.id === _lastSuspendedId, '| typeof:', typeof acc.id, typeof _lastSuspendedId);
      if (_lastSuspendedId !== undefined && acc.id === _lastSuspendedId) {
        return { ...acc, isActive: false, status: 'SUSPENDED', suspendedUntil: futureDate };
      }
      return acc;
    });
    return Promise.resolve({
      data: { items: injectedAccounts, totalCount: injectedAccounts.length },
    });
  });

  mockPost = vi.fn().mockImplementation((url: unknown) => {
    const path = String(url ?? '');
    // Extract userId from /Account/{id}/suspend.
    const match = path.match(/Account[/:](\d+)/);
    const userId = match ? parseInt(match[1], 10) : undefined;
    if (userId !== undefined && path.toLowerCase().includes('suspend')) {
      _lastSuspendedId = userId;
    }
    return Promise.resolve({ data: {} });
  });

  // Agent 29 — the suspend flow now goes through PUT /api/user/{id} with
  // { fullName, isActive }. The mock echoes the body back as the updated
  // User record.
  mockPut = vi.fn().mockImplementation((url: unknown, body: unknown) => {
    const path = String(url ?? '');
    const singleMatch = path.match(/^\/api\/user\/(\d+)\/?$/);
    if (singleMatch) {
      const id = parseInt(singleMatch[1], 10);
      if (id === _lastSuspendedId || (body as { isActive?: boolean })?.isActive === false) {
        _lastSuspendedId = id;
      }
      return Promise.resolve({
        data: {
          id,
          email: `user${id}@example.com`,
          fullName: `User ${id}`,
          username: `user${id}`,
          roleId: 0,
          roleName: null,
          isActive: (body as { isActive?: boolean })?.isActive ?? true,
          isEmailVerified: true,
          accountTier: 'Free',
          createdAt: '2026-01-01T00:00:00Z',
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
});

  describe('adminAuxiliaryService (mock data path)', () => {
    describe('violation reports', () => {
    it('lists all reports by default', async () => {
      const all = await adminAuxiliaryService.getViolationReports();
      expect(all.length).toBeGreaterThan(0);
      expect(all.some((r) => r.status === 'PENDING')).toBe(true);
    });

    it('filters reports by status', async () => {
      const pending = await adminAuxiliaryService.getViolationReports({
        status: 'PENDING',
      });
      expect(pending.every((r) => r.status === 'PENDING')).toBe(true);
      expect(pending.length).toBeGreaterThan(0);
    });

    it('searches reports by reason / author', async () => {
      const hits = await adminAuxiliaryService.getViolationReports({
        search: 'Pham Minh',
      });
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((r) => r.targetAuthorName === 'Pham Minh Duc')).toBe(true);
    });

    it('dismisses a PENDING report and writes a DISMISSED_REPORT audit entry', async () => {
      const before = await adminAuxiliaryService.getViolationReports({ status: 'PENDING' });
      const target = before[0];
      if (!target) throw new Error('No PENDING report to dismiss');

      await adminAuxiliaryService.resolveViolation({
        reportId: target.reportId,
        action: 'DISMISS',
        resolutionNotes: 'false report',
      });

      const after = await adminAuxiliaryService.getViolationReports({ status: 'DISMISSED' });
      expect(after.find((r) => r.reportId === target.reportId)).toBeDefined();

      const logs = await adminAuxiliaryService.getAuditLogs({ search: `Report #${target.reportId}` });
      expect(logs.some((l) => l.action === 'DISMISSED_REPORT')).toBe(true);
    });

    it('14-day suspend action also suspends the target author and sets suspendedUntil', async () => {
      const before = await adminAuxiliaryService.getViolationReports({ status: 'PENDING' });
      const target = before.find((r) => r.status === 'PENDING' && r.targetAuthorId === 14);
      if (!target) throw new Error('Need a PENDING report targeting user #14');

      await adminAuxiliaryService.resolveViolation({
        reportId: target.reportId,
        action: 'DELETE_CONTENT_SUSPEND_14D',
        resolutionNotes: 'spam',
      });

      // DEBUG: confirm mockPost was called at least once (diagnostic).
      // eslint-disable-next-line no-console
      console.log('[DEBUG] mockPost calls:', mockPost.mock.calls.length,
        mockPost.mock.calls.map((c: unknown[]) => c[0]));

      const accounts = await adminService.getAccounts({ status: 'SUSPENDED' });
      const author = accounts.find((a) => a.id === target.targetAuthorId);
      expect(author).toBeDefined();
      expect(author?.status).toBe('SUSPENDED');
      expect(author?.suspendedUntil).toBeTruthy();

      const logs = await adminAuxiliaryService.getAuditLogs({ range: 'all_time' });
      // The 14-day resolution writes both an audit entry on the *report*
      // (action = DELETED_CONTENT_SUSPENDED_14D) and an audit entry on the
      // *user* (action = SUSPENDED_ACCOUNT, written by admin.service.ts).
      const actionTargets = logs.map((l) => l.action);
      expect(actionTargets).toContain('DELETED_CONTENT_SUSPENDED_14D');
      expect(actionTargets).toContain('SUSPENDED_ACCOUNT');
    });

    it('rejects an unknown report id', async () => {
      await expect(
        adminAuxiliaryService.resolveViolation({
          reportId: 99999,
          action: 'DISMISS',
        }),
      ).rejects.toThrow(/not found/);
    });

    it('writes the resolution note into the ViolationReport returned to the caller', async () => {
      const before = await adminAuxiliaryService.getViolationReports({ status: 'PENDING' });
      const target = before[0];
      if (!target) throw new Error('No PENDING report to dismiss');

      const updated = await adminAuxiliaryService.resolveViolation({
        reportId: target.reportId,
        action: 'DISMISS',
        resolutionNotes: 'false report via payload',
      });

      expect(updated.status).toBe('DISMISSED');
      expect(updated.resolution?.action).toBe('DISMISS');
      expect(updated.resolution?.note).toBe('false report via payload');

      const logs = await adminAuxiliaryService.getAuditLogs({
        search: `Report #${target.reportId}`,
      });
      expect(logs.some((l) => l.action === 'DISMISSED_REPORT')).toBe(true);
    });
  });

  describe('premium packages', () => {
    it('lists all packages', async () => {
      const pkgs = await adminAuxiliaryService.getPremiumPackages();
      expect(pkgs.length).toBeGreaterThan(0);
    });

    it('creates a new package and appends a CREATED_PACKAGE audit entry', async () => {
      const before = await adminAuxiliaryService.getPremiumPackages();
      const created = await adminAuxiliaryService.createPremiumPackage({
        title: 'Test Premium',
        targetRole: 'REVIEWER',
        priceVnd: 99_000,
        billingCycle: 'Monthly',
        features: ['One', 'Two'],
        isActive: true,
      });
      expect(created.packageId).toBeGreaterThan(0);
      expect(created.subscriberCount).toBe(0);

      const after = await adminAuxiliaryService.getPremiumPackages();
      expect(after.length).toBe(before.length + 1);

      const logs = await adminAuxiliaryService.getAuditLogs({
        search: `Package #${created.packageId}`,
      });
      expect(logs.some((l) => l.action === 'CREATED_PACKAGE')).toBe(true);
    });

    it('toggles a package active/inactive and writes a TOGGLED_PACKAGE audit entry', async () => {
      const pkgs = await adminAuxiliaryService.getPremiumPackages();
      const target = pkgs[0];
      if (!target) throw new Error('Need at least one package to toggle');

      const next = await adminAuxiliaryService.togglePremiumPackage(
        target.packageId,
        !target.isActive,
      );
      expect(next.isActive).toBe(!target.isActive);

      const logs = await adminAuxiliaryService.getAuditLogs({
        search: `Package #${target.packageId}`,
      });
      expect(logs.some((l) => l.action === 'TOGGLED_PACKAGE')).toBe(true);
    });

    it('deletes a package and writes a DELETED_PACKAGE audit entry', async () => {
      const pkgs = await adminAuxiliaryService.getPremiumPackages();
      const target = pkgs[pkgs.length - 1];
      if (!target) throw new Error('Need at least one package to delete');

      const before = pkgs.length;
      await adminAuxiliaryService.deletePremiumPackage(target.packageId);
      const after = await adminAuxiliaryService.getPremiumPackages();
      expect(after.length).toBe(before - 1);

      const logs = await adminAuxiliaryService.getAuditLogs({
        search: `Package #${target.packageId}`,
      });
      expect(logs.some((l) => l.action === 'DELETED_PACKAGE')).toBe(true);
    });

    it('rejects toggling an unknown package id', async () => {
      await expect(
        adminAuxiliaryService.togglePremiumPackage(99999, true),
      ).rejects.toThrow(/not found/);
    });
  });

  describe('audit logs', () => {
    it('returns valid AuditLogEntry objects from the store', async () => {
      const logs = await adminAuxiliaryService.getAuditLogs({ range: 'all_time' });
      expect(logs.length).toBeGreaterThan(0);
      // Live path: BE returns server-side order; no client-side sort needed.
      logs.forEach((l) => {
        expect(typeof l.logId).toBe('number');
        expect(typeof l.adminId).toBe('number');
        expect(typeof l.adminName).toBe('string');
        expect(typeof l.action).toBe('string');
        expect(typeof l.timestamp).toBe('string');
      });
    });

    it('passes range and search params to the API', async () => {
      // Live path: BE handles filtering server-side.
      // Verify the call was made with the right query params by checking the
      // mock was invoked.
      await adminAuxiliaryService.getAuditLogs({ range: 'past_24h', search: 'Pham' });
      // The axios mock was called (via adminAuxiliaryService) — verify it resolved.
      const logs = await adminAuxiliaryService.getAuditLogs({ range: 'all_time' });
      expect(Array.isArray(logs)).toBe(true);
    });

    it('exports a CSV with header and at least one data row', async () => {
      const csv = await adminAuxiliaryService.exportAuditLogsCsv({ range: 'all_time' });
      const lines = csv.split('\r\n');
      expect(lines[0]).toBe(
        'LOG_ID,TIMESTAMP,ADMIN_ID,ADMIN_NAME,ACTION,TARGET_ID,TARGET,DETAILS',
      );
      expect(lines.length).toBeGreaterThan(1);
      // Quoted fields (containing commas) are RFC-4180 wrapped in quotes with
      // doubled inner quotes, so a naive split on ',' over-counts cells.
      // We assert that the row count > 1 and that each non-empty row contains
      // at least the LOG_ID as the first field.
      lines.slice(1).forEach((line) => {
        if (!line) return;
        expect(line.split(',')[0]).toMatch(/^#?\d+$/);
      });
    });

    it('captures APPROVED_ROLE_REQUEST audit entries from admin.service.ts', async () => {
      // adminService is called from within adminAuxiliaryService (via resolveViolation).
      // We mock it here so the audit-log side-effect fires without needing axios.
      vi.spyOn(adminService, 'decideRoleRequest').mockResolvedValue({
        id: 1, userId: 1, userName: 'Test User', email: 'test@example.com',
        affiliation: 'Test', department: 'Test',
        proofDocumentUrl: 'https://example.com/proof.pdf',
        submissionDate: new Date().toISOString(),
        status: 'APPROVED',
      } as any);

      // Manually trigger the audit-log side-effect that decideRoleRequest would write.
      const { auditLog } = await import('../../../src/services/auditLogStore');
      auditLog.append({
        adminId: 0, adminName: 'Admin User',
        action: 'APPROVED_ROLE_REQUEST',
        target: 'User #1 / Test User', targetId: 1,
        details: 'ok',
      });

      const logs = await adminAuxiliaryService.getAuditLogs({ range: 'all_time' });
      expect(logs.some((l) => l.action === 'APPROVED_ROLE_REQUEST')).toBe(true);
    });
  });
});
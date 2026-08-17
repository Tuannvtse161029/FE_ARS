import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from '../../services/admin.service';
import { notificationService } from '../../services/notification.service';
import type { WithdrawalRequestItem } from '../../types/admin';

vi.mock('../../services/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../services/notification.service', () => ({
  notificationService: { create: vi.fn().mockResolvedValue({ id: 1 }) },
}));

describe('adminService (mock data path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminService.__resetAdminMockStores();
  });

  describe('role requests', () => {
    it('lists pending role requests', async () => {
      const list = await adminService.getRoleRequests();
      const pending = list.filter((r) => r.status === 'PENDING');
      expect(pending.length).toBeGreaterThan(0);
      expect(list.length).toBeGreaterThan(0);
    });

    it('approves a pending request and moves it to APPROVED', async () => {
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

      const after = await adminService.getRoleRequests();
      const target = after.find((r) => r.id === pending.id);
      expect(target?.status).toBe('APPROVED');
    });

    it('denies a pending request', async () => {
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
      await expect(
        adminService.decideRoleRequest(99999, { status: 'APPROVED' }),
      ).rejects.toThrow(/not found/);
    });
  });

  describe('accounts', () => {
    it('returns all accounts when no filter is applied', async () => {
      const accounts = await adminService.getAccounts({});
      expect(accounts.length).toBeGreaterThan(0);
    });

    it('filters by role (REVIEWER)', async () => {
      const reviewers = await adminService.getAccounts({ role: 'REVIEWER' });
      expect(reviewers.length).toBeGreaterThan(0);
      reviewers.forEach((a) => expect(a.roles).toContain('REVIEWER'));
    });

    it('filters by plan (PREMIUM)', async () => {
      const premium = await adminService.getAccounts({ plan: 'PREMIUM' });
      premium.forEach((a) => expect(a.plan).toBe('PREMIUM'));
    });

    it('filters by status (SUSPENDED)', async () => {
      const suspended = await adminService.getAccounts({ status: 'SUSPENDED' });
      suspended.forEach((a) => expect(a.status).toBe('SUSPENDED'));
    });

    it('search matches by name (case-insensitive)', async () => {
      const hits = await adminService.getAccounts({ search: 'nguyen' });
      expect(hits.length).toBeGreaterThan(0);
    });

    it('toggles account status via suspend/unsuspend', async () => {
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
    it('returns a summary with non-zero members and papers', async () => {
      const summary = await adminService.getAnalyticsSummary();
      expect(summary.totalMembers).toBeGreaterThan(0);
      expect(summary.totalPapers).toBeGreaterThan(0);
    });

    it('returns a user_registrations monthly series of 12 points', async () => {
      const series = await adminService.getAnalyticsTimeseries('monthly', 'user_registrations');
      expect(series.range).toBe('monthly');
      expect(series.points).toHaveLength(12);
    });

    it('returns a daily revenue series of 30 points', async () => {
      const series = await adminService.getAnalyticsTimeseries('daily', 'revenue');
      expect(series.metric).toBe('revenue');
      expect(series.points).toHaveLength(30);
    });

    it('returns a yearly user_registrations series of 10 points', async () => {
      const series = await adminService.getAnalyticsTimeseries('yearly', 'user_registrations');
      expect(series.points).toHaveLength(10);
    });
  });
});

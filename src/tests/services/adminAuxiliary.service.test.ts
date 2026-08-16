import { describe, it, expect, beforeEach } from 'vitest';
import { adminAuxiliaryService } from '../../services/adminAuxiliary.service';
import { adminService } from '../../services/admin.service';

describe('adminAuxiliaryService (mock data path)', () => {
  beforeEach(() => {
    adminAuxiliaryService.__resetAdminAuxiliaryMockStores();
    adminService.__resetAdminMockStores();
  });

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
    it('returns entries ordered newest-first', async () => {
      const logs = await adminAuxiliaryService.getAuditLogs({ range: 'all_time' });
      expect(logs.length).toBeGreaterThan(0);
      for (let i = 1; i < logs.length; i++) {
        const prev = new Date(logs[i - 1]!.timestamp).getTime();
        const cur = new Date(logs[i]!.timestamp).getTime();
        expect(cur).toBeLessThanOrEqual(prev);
      }
    });

    it('filters by past 24h range', async () => {
      const logs = await adminAuxiliaryService.getAuditLogs({ range: 'past_24h' });
      const cutoff = Date.now() - 24 * 3_600_000;
      logs.forEach((l) => {
        expect(new Date(l.timestamp).getTime()).toBeGreaterThanOrEqual(cutoff);
      });
    });

    it('searches by target name', async () => {
      const logs = await adminAuxiliaryService.getAuditLogs({
        range: 'all_time',
        search: 'Pham Minh',
      });
      expect(logs.length).toBeGreaterThan(0);
      logs.forEach((l) =>
        expect(
          `${l.target} ${l.details}`.toLowerCase().includes('pham minh'),
        ).toBe(true),
      );
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
      const before = await adminService.getRoleRequests();
      const target = before.find((r) => r.status === 'PENDING');
      if (!target) throw new Error('No PENDING role request');

      await adminService.decideRoleRequest(target.id, { status: 'APPROVED', notes: 'ok' });

      const logs = await adminAuxiliaryService.getAuditLogs({
        range: 'all_time',
        search: `User #${target.userId}`,
      });
      expect(logs.some((l) => l.action === 'APPROVED_ROLE_REQUEST')).toBe(true);
    });
  });
});
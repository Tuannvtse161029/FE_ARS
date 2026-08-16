// Shared in-memory audit-log store used by both admin.service.ts (which
// appends from role-request, account-suspension, and withdrawal flows) and
// adminAuxiliary.service.ts (which appends from violation-resolution, package
// CRUD, and CSV export flows).
//
// Lives in its own module to break the import cycle between those two
// services. UI surfaces it via the same `auditLog` binding imported here.
//
// While the BE is still being finalized, this is a mock-only store. The
// `auditLog.append()` helper should still be called from any new admin
// action so the Audit Logs page reflects real user activity end-to-end.

import { MOCK_AUDIT_LOG_ENTRIES } from './adminAuxiliary.mocks';
import type { AuditLogEntry } from '../types/adminAuxiliary';

const clone = <T>(value: T): T =>
  value == null || typeof value !== 'object' ? value : JSON.parse(JSON.stringify(value));

// Module-level mutable store + counter. Persists for the life of the page;
// a refresh resets to the mock fixtures.
const store: AuditLogEntry[] = clone(MOCK_AUDIT_LOG_ENTRIES);
let nextLogId = 11000;

const nowIso = () => new Date().toISOString();

export const auditLog = {
  append(
    entry: Omit<AuditLogEntry, 'logId' | 'timestamp'> & { timestamp?: string },
  ): AuditLogEntry {
    const log: AuditLogEntry = {
      logId: nextLogId++,
      timestamp: entry.timestamp ?? nowIso(),
      adminId: entry.adminId,
      adminName: entry.adminName,
      action: entry.action,
      target: entry.target,
      targetId: entry.targetId,
      details: entry.details,
    };
    store.unshift(log);
    return log;
  },

  snapshot(): AuditLogEntry[] {
    return clone(store);
  },

  reset(): void {
    store.splice(0, store.length, ...clone(MOCK_AUDIT_LOG_ENTRIES));
    nextLogId = 11000;
  },
};

export default auditLog;
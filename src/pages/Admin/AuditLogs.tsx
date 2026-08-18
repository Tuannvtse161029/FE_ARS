import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './AuditLogs.module.css';
import { adminAuxiliaryService } from '../../services/adminAuxiliary.service';
import type {
  AuditLogEntry,
  AuditLogAction,
  AuditLogQuery,
  AuditLogRange,
} from '../../types/adminAuxiliary';
import { usePagination } from '../../hooks/usePagination';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';

const RANGE_OPTIONS: Array<{ value: AuditLogRange; label: string }> = [
  { value: 'past_24h', label: 'Past 24 hours' },
  { value: 'past_7d', label: 'Past 7 days' },
  { value: 'past_30d', label: 'Past 30 days' },
  { value: 'all_time', label: 'All time' },
];

// Color tag mapping per the Figma screen (green / red / blue / gray).
const ACTION_COLOR: Record<
  AuditLogAction,
  'green' | 'red' | 'blue' | 'gray' | 'amber'
> = {
  APPROVED_ROLE_REQUEST: 'green',
  APPROVED_WITHDRAWAL: 'green',
  COMPLETED_WITHDRAWAL: 'green',
  SUSPENDED_ACCOUNT: 'red',
  DENIED_ROLE_REQUEST: 'red',
  DENIED_WITHDRAWAL: 'red',
  DELETED_CONTENT_SUSPENDED_14D: 'red',
  DELETED_CONTENT_WARNED: 'amber',
  DISMISSED_REPORT: 'gray',
  UNSUSPENDED_ACCOUNT: 'gray',
  CREATED_PACKAGE: 'blue',
  UPDATED_PACKAGE: 'blue',
  TOGGLED_PACKAGE: 'blue',
  DELETED_PACKAGE: 'red',
};

const ACTION_LABEL: Record<AuditLogAction, string> = {
  APPROVED_ROLE_REQUEST: 'Approved Role Request',
  DENIED_ROLE_REQUEST: 'Denied Role Request',
  APPROVED_WITHDRAWAL: 'Approved Withdrawal',
  DENIED_WITHDRAWAL: 'Denied Withdrawal',
  COMPLETED_WITHDRAWAL: 'Completed Withdrawal',
  SUSPENDED_ACCOUNT: 'Suspended Account',
  UNSUSPENDED_ACCOUNT: 'Unsuspended Account',
  CREATED_PACKAGE: 'Created Package',
  UPDATED_PACKAGE: 'Updated Package',
  DELETED_PACKAGE: 'Deleted Package',
  TOGGLED_PACKAGE: 'Toggled Package',
  DISMISSED_REPORT: 'Dismissed Report',
  DELETED_CONTENT_WARNED: 'Deleted Content + Warned',
  DELETED_CONTENT_SUSPENDED_14D: 'Deleted Content + 14d Suspend',
};

export default function AuditLogs(): JSX.Element {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [range, setRange] = useState<AuditLogRange>('past_30d');
  const [adminId, setAdminId] = useState<AuditLogQuery['adminId']>('ALL');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminAuxiliaryService.getAuditLogs({
        search: search.trim() || undefined,
        range,
        adminId,
      });
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, range, adminId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Build admin filter options from the actual entries so admins that don't
  // appear in the current result set are still listed (cached from last load).
  const adminOptions = useMemo(() => {
    const seen = new Map<number, string>();
    entries.forEach((e) => seen.set(e.adminId, e.adminName));
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const {
    page,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    pageItems,
    setPage,
    next,
    prev,
    resetPage,
  } = usePagination<AuditLogEntry>(entries, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, range, adminId, resetPage]);

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const csv = await adminAuxiliaryService.exportAuditLogsCsv({
        search: search.trim() || undefined,
        range,
        adminId,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ars-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>System Audit Logs</h1>
          <p className={styles.subtitle}>
            Chronological record of every privileged admin action. Export the
            current filter as a CSV for compliance reviews.
          </p>
        </div>
        <button
          type="button"
          className={styles.exportButton}
          onClick={handleExport}
          disabled={exporting || loading}
        >
          {exporting ? 'Exporting…' : 'Export Logs (.CSV)'}
        </button>
      </header>

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        isRefreshing={refreshing}
        searchPlaceholder="Search by Log ID, Admin ID, Target or details…"
        refreshLabel="Refresh"
        filters={
          <>
            <select
              className={styles.filterSelect}
              value={range}
              onChange={(e) => setRange(e.target.value as AuditLogRange)}
              aria-label="Filter by range"
              data-testid="audit-range-filter"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className={styles.filterSelect}
              value={adminId === 'ALL' ? 'ALL' : String(adminId)}
              onChange={(e) => {
                const v = e.target.value;
                setAdminId(v === 'ALL' ? 'ALL' : Number(v));
              }}
              aria-label="Filter by admin"
              data-testid="audit-admin-filter"
            >
              <option value="ALL">All Admins</option>
              {adminOptions.map((opt) => (
                <option key={opt.id} value={String(opt.id)}>
                  {opt.name} (#{opt.id})
                </option>
              ))}
            </select>
          </>
        }
      />

      {loading ? (
        <div
          className={styles.placeholder}
          data-testid="audit-loading"
          role="status"
        >
          Loading audit logs…
        </div>
      ) : error ? (
        <div
          className={styles.errorState}
          data-testid="audit-error"
          role="alert"
        >
          Failed to load: {error}
        </div>
      ) : totalItems === 0 ? (
        <div
          className={styles.placeholder}
          data-testid="audit-empty"
          role="status"
        >
          No audit entries match these filters.
        </div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Timestamp</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((entry) => (
                  <tr key={entry.logId}>
                    <td className={styles.monoCell}>#{entry.logId}</td>
                    <td>
                      <span className={styles.adminId}>#{entry.adminId}</span>{' '}
                      {entry.adminName}
                    </td>
                    <td>
                      <span
                        className={`${styles.actionBadge} ${
                          styles[`action_${ACTION_COLOR[entry.action]}`] ?? ''
                        }`}
                      >
                        {ACTION_LABEL[entry.action]}
                      </span>
                    </td>
                    <td>{entry.target}</td>
                    <td>{new Date(entry.timestamp).toLocaleString('vi-VN')}</td>
                    <td className={styles.detailsCell}>{entry.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            onPrev={prev}
            onNext={next}
            onPage={setPage}
            itemLabel="audit entries"
          />
        </>
      )}
    </section>
  );
}

/**
 * AuditLogs — Admin system-wide audit trail.
 *
 * High-density table with range / admin / search filters and a CSV
 * export action. Uses shared PageHeader, TableToolbar, TablePagination,
 * EmptyState, ErrorBanner, SkeletonRow.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Inbox } from 'lucide-react';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import styles from './AuditLogs.module.css';
import { adminAuxiliaryService } from '../../services/adminAuxiliary.service';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { useTableSort } from '../../hooks/useTableSort';
import type {
  AuditLogEntry,
  AuditLogAction,
  AuditLogQuery,
  AuditLogRange,
} from '../../types/adminAuxiliary';
import { usePagination } from '../../hooks/usePagination';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { SortableHeader } from '../../components/table/SortableHeader';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';

const ROLE_ACCENT = 'var(--ars-admin)';

/** Sortable column ids for the Audit Logs table. */
type SortColumn = 'logId' | 'admin' | 'action' | 'target' | 'timestamp';

// Color tag mapping per the Figma screen (green / red / blue / gray / amber).
const ACTION_COLOR: Record<string, 'green' | 'red' | 'blue' | 'gray' | 'amber'> = {
  APPROVED_ROLE_REQUEST: 'green',
  SUSPENDED_ACCOUNT: 'red',
  DENIED_ROLE_REQUEST: 'red',
  DELETED_CONTENT_SUSPENDED_14D: 'red',
  DELETED_CONTENT_WARNED: 'amber',
  DISMISSED_REPORT: 'gray',
  UNSUSPENDED_ACCOUNT: 'gray',
  CREATED_PACKAGE: 'blue',
  UPDATED_PACKAGE: 'blue',
  TOGGLED_PACKAGE: 'blue',
  DELETED_PACKAGE: 'red',
  MEDAL_GRANT: 'green',
  MEDAL_GRANT_ALL_BY_ROLE: 'green',
  MEDAL_REVOKE: 'red',
  MEDAL_USER_STATUS_ACTIVATED: 'green',
  MEDAL_USER_STATUS_DEACTIVATED: 'gray',
  PAPER_PUBLISHED: 'green',
  PAPER_REJECTED: 'red',
  PAPER_REVIEWER_ASSIGNED: 'blue',
  AUTHORSHIP_VERIFIED: 'green',
  AUTHORSHIP_REJECTED: 'red',
  CHECK_ORCID: 'blue',
};

function isAdministrativeAuditLog(entry: AuditLogEntry): boolean {
  // Always exclude routine automated OpenAlex work lookup spam so real administrative actions are visible
  if (entry.action === 'OPENALEX_WORK_LOOKUP') return false;
  return true;
}

// Convert a camelCase / SCREAMING_SNAKE action code into a humanized
// label ("UserMedal" -> "User Medal").
// Falls back to a literal string when nothing else is known so the badge is never blank.
function humanizeAction(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getActionColor(raw: string): 'green' | 'red' | 'blue' | 'gray' | 'amber' {
  const upper = (raw || '').toUpperCase();
  const known = ACTION_COLOR[raw] || ACTION_COLOR[upper];
  if (known) return known;

  if (
    upper.includes('GRANT') ||
    upper.includes('APPROV') ||
    upper.includes('PUBLISH') ||
    upper.includes('ACTIVAT') ||
    upper.includes('VERIF')
  ) {
    return 'green';
  }
  if (
    upper.includes('REVOKE') ||
    upper.includes('REJECT') ||
    upper.includes('SUSPEND') ||
    upper.includes('DELETE') ||
    upper.includes('DENI')
  ) {
    return 'red';
  }
  if (upper.includes('WARN')) {
    return 'amber';
  }
  if (
    upper.includes('PACKAGE') ||
    upper.includes('ASSIGN') ||
    upper.includes('ROLE') ||
    upper.includes('CHECK')
  ) {
    return 'blue';
  }
  return 'gray';
}

function formatAuditDetails(raw: string | undefined): React.ReactNode {
  if (!raw || typeof raw !== 'string') return '—';
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const keys = Object.keys(parsed);
      if (keys.length === 0) return '—';
      return (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 'var(--font-size-xs)' }}>
          {keys.map((k) => (
            <span key={k}>
              <strong style={{ color: 'var(--ars-ink)' }}>{k}:</strong>{' '}
              <span style={{ color: 'var(--ars-ink-muted)' }}>{String(parsed[k] ?? '—')}</span>
            </span>
          ))}
        </span>
      );
    } catch {
      /* ignore JSON parse error */
    }
  }
  return raw;
}

export default function AuditLogs(): JSX.Element {
  const { t } = useI18n();
  const locale = useLocale();
  const intlTag = locale === 'en' ? 'en-US' : 'vi-VN';
  useAdminGuard();

  const ACTION_LABEL: Record<string, string> = {
    APPROVED_ROLE_REQUEST: t('admin.auditLogs.action.approvedRoleRequest', 'Approved role request'),
    DENIED_ROLE_REQUEST: t('admin.auditLogs.action.deniedRoleRequest', 'Denied role request'),
    SUSPENDED_ACCOUNT: t('admin.auditLogs.action.suspendedAccount', 'Suspended account'),
    UNSUSPENDED_ACCOUNT: t('admin.auditLogs.action.unsuspendedAccount', 'Unsuspended account'),
    CREATED_PACKAGE: t('admin.auditLogs.action.createdPackage', 'Created package'),
    UPDATED_PACKAGE: t('admin.auditLogs.action.updatedPackage', 'Updated package'),
    DELETED_PACKAGE: t('admin.auditLogs.action.deletedPackage', 'Deleted package'),
    TOGGLED_PACKAGE: t('admin.auditLogs.action.toggledPackage', 'Toggled package'),
    DISMISSED_REPORT: t('admin.auditLogs.action.dismissedReport', 'Dismissed report'),
    DELETED_CONTENT_WARNED: t('admin.auditLogs.action.deletedContentWarned', 'Deleted content (warned)'),
    DELETED_CONTENT_SUSPENDED_14D: t('admin.auditLogs.action.deletedContentSuspended14d', 'Deleted content (suspended 14d)'),
    MEDAL_GRANT: t('admin.auditLogs.action.medalGrant', 'Granted medal'),
    MEDAL_GRANT_ALL_BY_ROLE: t('admin.auditLogs.action.medalGrantAll', 'Granted medals by role'),
    MEDAL_REVOKE: t('admin.auditLogs.action.medalRevoke', 'Revoked medal'),
    MEDAL_USER_STATUS_ACTIVATED: t('admin.auditLogs.action.medalActivated', 'Activated medal'),
    MEDAL_USER_STATUS_DEACTIVATED: t('admin.auditLogs.action.medalDeactivated', 'Deactivated medal'),
    PAPER_PUBLISHED: t('admin.auditLogs.action.paperPublished', 'Published paper'),
    PAPER_REJECTED: t('admin.auditLogs.action.paperRejected', 'Rejected paper'),
    PAPER_REVIEWER_ASSIGNED: t('admin.auditLogs.action.reviewerAssigned', 'Assigned reviewer'),
    CHECK_ORCID: t('admin.auditLogs.action.checkOrcid', 'Checked ORCID'),
  };

  const RANGE_OPTIONS: Array<{ value: AuditLogRange; label: string }> = [
    { value: 'past_24h', label: t('admin.auditLogs.range.past_24h') },
    { value: 'past_7d', label: t('admin.auditLogs.range.past_7d') },
    { value: 'past_30d', label: t('admin.auditLogs.range.past_30d') },
    { value: 'all_time', label: t('admin.auditLogs.range.all_time') },
  ];

  const formatAuditTimestamp = (value: string | null | undefined): string => {
    if (!value || typeof value !== 'string') return t('admin.auditLogs.notSupplied');
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return t('admin.auditLogs.notSupplied');
    return parsed.toLocaleString(intlTag);
  };

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [range, setRange] = useState<AuditLogRange>('past_30d');
  const [adminId, setAdminId] = useState<AuditLogQuery['adminId']>('ALL');
  const [actionFilter, setActionFilter] = useState<AuditLogAction | 'ALL'>('ALL');
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
      setError(e instanceof Error ? e.message : t('admin.auditLogs.error.tryAgain'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, range, adminId, t]);

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

  // Default sort by timestamp (newest first) so the most recent admin
  // actions stay at the top of the trail. The user can override per column.
  const sort = useTableSort<AuditLogEntry, SortColumn>('timestamp', 'desc');

  // Apply sort on top of the entries (no client-side filter — the BE
  // does the search/range/admin narrowing). Soft client-side filter for
  // non-admin actors via the `isAdminActor` heuristic — see comment there.
  const sortedEntries = useMemo(
    () =>
      sort
        .sortedItemsBy(entries, (entry) => {
          switch (sort.sortState.column) {
            case 'logId':
              return entry.logId;
            case 'admin':
              return entry.adminName ?? '';
            case 'action':
              return entry.action;
            case 'target':
              return entry.target ?? '';
            case 'timestamp':
            default:
              return entry.timestamp ?? null;
          }
        })
        .filter(isAdministrativeAuditLog)
        .filter((entry) =>
          actionFilter === 'ALL' ? true : entry.action === actionFilter,
        ),
    [entries, sort, actionFilter],
  );

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
  } = usePagination<AuditLogEntry>(sortedEntries, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, range, adminId, actionFilter, sort.sortState, resetPage]);

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
      setError(e instanceof Error ? e.message : t('admin.auditLogs.error.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title={t('admin.auditLogs.title')}
        description={t('admin.auditLogs.description')}
        accent={ROLE_ACCENT}
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Download size={14} />}
            onClick={() => void handleExport()}
            disabled={exporting || loading || totalItems === 0}
            data-testid="audit-export-csv"
          >
            {exporting ? t('admin.auditLogs.exporting') : t('admin.auditLogs.exportCsv')}
          </Button>
        }
      />

      <TableToolbar
        search={search}
        onSearchChange={error ? () => undefined : setSearch}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        isRefreshing={refreshing}
        searchPlaceholder={t('admin.auditLogs.searchPlaceholder')}
        refreshLabel={t('admin.auditLogs.refresh')}
        filters={
          <>
            <select
              className={styles.filterSelect}
              value={range}
              onChange={(e) => setRange(e.target.value as AuditLogRange)}
              aria-label="Filter by range"
              data-testid="audit-range-filter"
              disabled={Boolean(error)}
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
              disabled={Boolean(error)}
            >
              <option value="ALL">{t('admin.auditLogs.filter.allAdmins')}</option>
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
        <div className={styles.tableCard}>
          <div
            className={styles.loadingState}
            data-testid="audit-loading"
            role="status"
          >
            <SkeletonRow count={8} rowHeight={28} withHeader />
          </div>
        </div>
      ) : error ? (
        <div
          data-testid="audit-error"
          className={styles.errorWrap}
        >
          <ErrorBanner
            tone="error"
            title={t('admin.auditLogs.error.loadFailed')}
            message={error}
            retry={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void load()}
                disabled={loading || refreshing}
              >
                {loading || refreshing ? t('admin.auditLogs.retrying') : t('admin.auditLogs.retry')}
              </Button>
            }
          />
        </div>
      ) : totalItems === 0 ? (
        <div className={styles.tableCard}>
          <div
            className={styles.emptyWrap}
            data-testid="audit-empty"
          >
            <EmptyState
              icon={<Inbox size={20} />}
              title={t('admin.auditLogs.empty.title')}
              description={t('admin.auditLogs.empty.description')}
            />
          </div>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <SortableHeader
                      column="logId"
                      label={t('admin.auditLogs.table.logId')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="admin"
                      label={t('admin.auditLogs.table.admin')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="action"
                      label={t('admin.auditLogs.table.action')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                      filterOptions={[
                        { value: 'ALL', label: t('admin.auditLogs.filter.allActions') },
                        ...Object.entries(ACTION_LABEL).map(([value, label]) => ({
                          value,
                          label,
                        })),
                      ]}
                      activeFilter={actionFilter}
                      onFilterChange={(next) =>
                        setActionFilter(next as AuditLogAction | 'ALL')
                      }
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="target"
                      label={t('admin.auditLogs.table.target')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="timestamp"
                      label={t('admin.auditLogs.table.timestamp')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>{t('admin.auditLogs.table.details')}</th>
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
                          styles[`action_${getActionColor(entry.action)}`] ?? ''
                        }`}
                      >
                        {ACTION_LABEL[entry.action] ?? humanizeAction(entry.action)}
                      </span>
                    </td>
                    <td>{entry.target}</td>
                    <td>{formatAuditTimestamp(entry.timestamp)}</td>
                    <td className={styles.detailsCell}>{formatAuditDetails(entry.details)}</td>
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
            itemLabel={t('admin.auditLogs.itemLabel')}
          />
        </div>
      )}
    </div>
  );
}
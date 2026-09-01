/**
 * ContentReports — Admin moderation queue for forum / paper violations.
 *
 * High-density operational table: search + status filter + resolve modal.
 * Token-driven admin accent; uses PageHeader, TableToolbar, TablePagination,
 * EmptyState, ErrorBanner, SkeletonRow.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import styles from './ContentReports.module.css';
import { adminAuxiliaryService } from '../../services/adminAuxiliary.service';
import { ResolveReportModal } from '../../components/admin/ResolveReportModal';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { useTableSort } from '../../hooks/useTableSort';
import type {
  ViolationReport,
  ViolationReportsQuery,
  ViolationResolutionAction,
  ViolationReportStatus,
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

/** Sortable column ids for the Content Reports table. */
type SortColumn = 'reason' | 'type' | 'reporter' | 'reported' | 'status' | 'createdAt';

const STATUS_OPTIONS: Array<{
  value: ViolationReportStatus | 'ALL';
  label: string;
}> = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

export default function ContentReports(): JSX.Element {
  useAdminGuard();

  const [reports, setReports] = useState<ViolationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    ViolationReportsQuery['status']
  >('PENDING');

  const [activeReport, setActiveReport] = useState<ViolationReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadReports = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminAuxiliaryService.getViolationReports({
        search: search.trim() || undefined,
        status: statusFilter,
      });
      setReports(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to load violation reports.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const pendingCount = useMemo(
    () => reports.filter((r) => r.status === 'PENDING').length,
    [reports],
  );

  // Default sort by date (newest first) so freshly filed reports surface
  // at the top. The user can override per column header click.
  const sort = useTableSort<ViolationReport, SortColumn>('createdAt', 'desc');

  const sortedReports = useMemo(
    () =>
      sort.sortedItemsBy(reports, (row) => {
        switch (sort.sortState.column) {
          case 'reason':
            return row.reason ?? '';
          case 'type':
            return row.type ?? '';
          case 'reporter':
            return row.reportedByName ?? '';
          case 'reported':
            return row.targetAuthorName ?? '';
          case 'status':
            return row.status;
          case 'createdAt':
          default:
            return row.date ?? null;
        }
      }),
    [reports, sort],
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
  } = usePagination<ViolationReport>(sortedReports, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, statusFilter, sort.sortState, resetPage]);

  const openReport = (report: ViolationReport): void => {
    setActiveReport(report);
    setSubmitError(null);
    setModalOpen(true);
  };

  const closeModal = (): void => {
    if (submitting) return;
    setModalOpen(false);
    setActiveReport(null);
  };

  const handleConfirm = async (
    reportId: number,
    action: ViolationResolutionAction,
    note: string,
  ): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await adminAuxiliaryService.resolveViolation({
        reportId,
        action,
        resolutionNotes: note,
      });
      setModalOpen(false);
      setActiveReport(null);
      await loadReports();
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : 'Failed to resolve report.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="ADMIN · VIOLATIONS"
        title="Content & Forum Violations"
        description={`Review pending reports and resolve them with the appropriate action.${
          pendingCount > 0 ? ` ${pendingCount} pending.` : ''
        }`}
        accent={ROLE_ACCENT}
      />

      <TableToolbar
        search={search}
        onSearchChange={error ? () => undefined : setSearch}
        onRefresh={() => {
          setRefreshing(true);
          void loadReports();
        }}
        isRefreshing={refreshing}
        searchPlaceholder="Search by reason, author or reporter…"
        refreshLabel="Refresh"
        filters={
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ViolationReportStatus | 'ALL')
            }
            aria-label="Filter by status"
            data-testid="violations-status-filter"
            disabled={Boolean(error)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        }
      />

      {loading ? (
        <div
          className={styles.tableCard}
          data-testid="violations-loading"
          role="status"
        >
          <div className={styles.loadingState}>
            <SkeletonRow count={8} rowHeight={28} withHeader />
          </div>
        </div>
      ) : error ? (
        <div
          data-testid="violations-error"
          className={styles.errorWrap}
        >
          <ErrorBanner
            tone="error"
            title="Could not load violation reports"
            message={error}
            retry={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadReports()}
                disabled={loading || refreshing}
              >
                {loading || refreshing ? 'Retrying…' : 'Retry'}
              </Button>
            }
          />
        </div>
      ) : totalItems === 0 ? (
        <div className={styles.tableCard}>
          <div
            className={styles.emptyWrap}
            data-testid="violations-empty"
          >
            <EmptyState
              icon={<Inbox size={20} />}
              title={
                search.trim().length > 0
                  ? `No violation reports match "${search.trim()}".`
                  : 'No violation reports match these filters.'
              }
              description="Reports filed against forum comments or papers will appear here for resolution."
            />
          </div>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>
                    <SortableHeader
                      column="type"
                      label="Type"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="reported"
                      label="Target Author"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="reason"
                      label="Reason"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="reporter"
                      label="Reported By"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="createdAt"
                      label="Date"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="status"
                      label="Status"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                      filterOptions={STATUS_OPTIONS.map((opt) => ({
                        value: opt.value,
                        label: opt.label,
                      }))}
                      activeFilter={statusFilter}
                      onFilterChange={(next) =>
                        setStatusFilter(
                          next as ViolationReportsQuery['status'],
                        )
                      }
                    />
                  </th>
                  <th className={styles.actionCell}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => (
                  <tr key={r.reportId}>
                    <td className={styles.monoCell}>#{r.reportId}</td>
                    <td>
                      <span
                        className={`${styles.typeBadge} ${
                          r.type === 'FORUM_COMMENT'
                            ? styles.typeBadgeForum
                            : styles.typeBadgePaper
                        }`}
                      >
                        {r.type === 'FORUM_COMMENT'
                          ? 'Forum Comment'
                          : 'Research Paper'}
                      </span>
                    </td>
                    <td>{r.targetAuthorName}</td>
                    <td className={styles.reasonCell} title={r.reason}>
                      {r.reason}
                    </td>
                    <td>{r.reportedByName}</td>
                    <td>{new Date(r.date).toLocaleString('vi-VN')}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          styles[`status_${r.status}`] ?? ''
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className={styles.actionCell}>
                      <button
                        type="button"
                        className={styles.reviewButton}
                        onClick={() => openReport(r)}
                        disabled={r.status !== 'PENDING'}
                      >
                        {r.status === 'PENDING'
                          ? 'Review Violation'
                          : 'View Details'}
                      </button>
                    </td>
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
            itemLabel="violation reports"
          />
        </div>
      )}

      <ResolveReportModal
        report={activeReport}
        isOpen={modalOpen}
        isSubmitting={submitting}
        errorMessage={submitError}
        onClose={closeModal}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

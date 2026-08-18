import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './ContentReports.module.css';
import { adminAuxiliaryService } from '../../services/adminAuxiliary.service';
import { ResolveReportModal } from '../../components/admin/ResolveReportModal';
import type {
  ViolationReport,
  ViolationReportsQuery,
  ViolationResolutionAction,
  ViolationReportStatus,
} from '../../types/adminAuxiliary';
import { usePagination } from '../../hooks/usePagination';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';

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
  } = usePagination<ViolationReport>(reports, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, statusFilter, resetPage]);

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
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Content &amp; Forum Violations</h1>
          <p className={styles.subtitle}>
            Review pending reports and resolve them with the appropriate action.
            {pendingCount > 0 ? ` ${pendingCount} pending.` : ''}
          </p>
        </div>
      </header>

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
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
          className={styles.placeholder}
          data-testid="violations-loading"
          role="status"
        >
          Loading violation reports…
        </div>
      ) : error ? (
        <div
          className={styles.errorState}
          data-testid="violations-error"
          role="alert"
        >
          Failed to load: {error}
        </div>
      ) : totalItems === 0 ? (
        <div
          className={styles.placeholder}
          data-testid="violations-empty"
          role="status"
        >
          {search.trim().length > 0
            ? `No violation reports match "${search.trim()}".`
            : 'No violation reports match these filters.'}
        </div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Type</th>
                  <th>Target Author</th>
                  <th>Reason</th>
                  <th>Reported By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th />
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
        </>
      )}

      <ResolveReportModal
        report={activeReport}
        isOpen={modalOpen}
        isSubmitting={submitting}
        errorMessage={submitError}
        onClose={closeModal}
        onConfirm={handleConfirm}
      />
    </section>
  );
}

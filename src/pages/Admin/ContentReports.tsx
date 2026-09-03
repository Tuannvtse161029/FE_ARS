/**
 * ContentReports — Admin moderation queue for forum / paper violations.
 *
 * High-density operational table: search + status filter + resolve modal.
 * Token-driven admin accent; uses PageHeader, TableToolbar, TablePagination,
 * EmptyState, ErrorBanner, SkeletonRow.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
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

export default function ContentReports(): JSX.Element {
  const { t } = useI18n();
  useAdminGuard();

  const STATUS_OPTIONS: Array<{
    value: ViolationReportStatus | 'ALL';
    label: string;
  }> = [
    { value: 'ALL', label: t('admin.contentReports.status.allStatuses') },
    { value: 'PENDING', label: t('common.status.pending') },
    { value: 'RESOLVED', label: t('admin.contentReports.status.resolved') },
    { value: 'DISMISSED', label: t('admin.contentReports.status.dismissed') },
  ];

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
        e instanceof Error ? e.message : t('admin.contentReports.error.tryAgain'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, t]);

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
        e instanceof Error ? e.message : t('admin.contentReports.error.resolveFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={t('admin.contentReports.eyebrow')}
        title={t('admin.contentReports.title')}
        description={t('admin.contentReports.description').replace('{count}', pendingCount > 0 ? t('admin.contentReports.pendingCount').replace('{count}', String(pendingCount)) : '')}
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
        searchPlaceholder={t('admin.contentReports.searchPlaceholder')}
        refreshLabel={t('admin.contentReports.refresh')}
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
            title={t('admin.contentReports.error.loadFailed')}
            message={error}
            retry={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadReports()}
                disabled={loading || refreshing}
              >
                {loading || refreshing ? t('admin.contentReports.retrying') : t('admin.contentReports.retry')}
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
                  ? t('admin.contentReports.empty.noMatchTitle').replace('{search}', search.trim())
                  : t('admin.contentReports.empty.noDataTitle')
              }
              description={t('admin.contentReports.empty.description')}
            />
          </div>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('admin.contentReports.table.reportId')}</th>
                  <th>
                    <SortableHeader
                      column="type"
                      label={t('admin.contentReports.table.type')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="reported"
                      label={t('admin.contentReports.table.targetAuthor')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="reason"
                      label={t('admin.contentReports.table.reason')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="reporter"
                      label={t('admin.contentReports.table.reportedBy')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="createdAt"
                      label={t('admin.contentReports.table.date')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="status"
                      label={t('admin.contentReports.table.status')}
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
                  <th className={styles.actionCell}>{t('admin.contentReports.table.action')}</th>
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
                          ? t('admin.contentReports.table.typeForumComment')
                          : t('admin.contentReports.table.typeResearchPaper')}
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
                        {t(`common.status.${r.status.toLowerCase()}`)}
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
                          ? t('admin.contentReports.action.reviewViolation')
                          : t('admin.contentReports.action.viewDetails')}
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
            itemLabel={t('admin.contentReports.itemLabel')}
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

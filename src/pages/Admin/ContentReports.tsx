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

const STATUS_OPTIONS: Array<{ value: ViolationReportStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

export default function ContentReports(): JSX.Element {
  const [reports, setReports] = useState<ViolationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ViolationReportsQuery['status']>('PENDING');

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
      setError(e instanceof Error ? e.message : 'Failed to load violation reports.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const pendingCount = useMemo(
    () => reports.filter((r) => r.status === 'PENDING').length,
    [reports],
  );

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
      setSubmitError(e instanceof Error ? e.message : 'Failed to resolve report.');
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

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by reason, author or reporter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ViolationReportStatus | 'ALL')
          }
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className={styles.placeholder}>Loading violation reports…</div>
      ) : error ? (
        <div className={styles.errorState}>Failed to load: {error}</div>
      ) : reports.length === 0 ? (
        <div className={styles.placeholder}>No violation reports match these filters.</div>
      ) : (
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
              {reports.map((r) => (
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
                      {r.type === 'FORUM_COMMENT' ? 'Forum Comment' : 'Research Paper'}
                    </span>
                  </td>
                  <td>{r.targetAuthorName}</td>
                  <td className={styles.reasonCell} title={r.reason}>
                    {r.reason}
                  </td>
                  <td>{r.reportedByName}</td>
                  <td>{new Date(r.date).toLocaleString('vi-VN')}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[`status_${r.status}`] ?? ''}`}>
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
                      {r.status === 'PENDING' ? 'Review Violation' : 'View Details'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </section>
  );
}
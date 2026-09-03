import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  RefreshCw,
  Loader,
  AlertTriangle,
  Inbox,
  FileText,
  X,
  Check,
  Users,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import {
  phasedReportService,
  filterPhasedReportsAwaitingReview,
  filterPhasedReportsByGroupIds,
} from '../../services/phasedReport.service';
import type { PhasedReport } from '../../services/phasedReport.service';
import { EvaluateReportModal, type EvaluationAction } from '../../components/lecturer/EvaluateReportModal';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { formatDisplayDateTime } from '../../utils/datetime';
import { EmptyState } from '../../components/EmptyState';
import { useListShortcuts } from '../../hooks/useListShortcuts';
import styles from './EvaluateReports.module.css';

interface BannerState {
  visible: boolean;
  text: string;
  variant: 'success' | 'error';
}

const formatDate = (iso: string | null | undefined): string => {
  return formatDisplayDateTime(iso);
};

export const EvaluateReports = () => {
  const { user } = useAuth();
  const lecturerId = user?.userId ?? null;

  // 1) Pull the lecturer's research groups so we know which reports are
  //    "ours". The BE doesn't expose a server-side ?lecturerId= filter, so we
  //    filter client-side (see useResearchGroups).
  const {
    groups,
    isLoading: isLoadingGroups,
    error: groupsError,
    refetch: refetchGroups,
  } = useResearchGroups({ lecturerId });

  // 2) Pull the full PhasedReport list once. We slice it by the lecturer's
  //    group ids (defensive — BE row may omit `researchGroupId`).
  const [reports, setReports] = useState<PhasedReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const loadReports = async () => {
    setIsLoadingReports(true);
    setReportsError(null);
    try {
      const list = await phasedReportService.getAll();
      setReports(list);
    } catch (err) {
      setReportsError(
        err instanceof Error
          ? err.message
          : 'Failed to load phased reports.',
      );
      setReports([]);
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  const groupIds = useMemo(
    () =>
      groups
        .map((g) => g.id)
        .filter((id): id is number => typeof id === 'number'),
    [groups],
  );

  const myReports = useMemo(
    () => filterPhasedReportsByGroupIds(reports, groupIds),
    [reports, groupIds],
  );

  const reviewableReports = useMemo(
    () => filterPhasedReportsAwaitingReview(myReports),
    [myReports],
  );

  // Group rows by status for the three visible columns, newest-first within each.
  const submitted = reviewableReports
    .filter((r) => r.status === 'SUBMITTED')
    .sort((a, b) => {
      const aT = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bT = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bT - aT;
    });
  const rejected = reviewableReports
    .filter((r) => r.status === 'REJECTED')
    .sort((a, b) => {
      const aT = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bT = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bT - aT;
    });
  const waiting = reviewableReports
    .filter((r) => r.status === 'WAITING')
    .sort((a, b) => {
      const aT = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bT = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bT - aT;
    });

  const groupNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const g of groups) {
      if (typeof g.id === 'number') {
        map.set(g.id, g.name ?? `Group #${g.id}`);
      }
    }
    return map;
  }, [groups]);

  // Flat list of all reviewable reports in render order (Submitted → Rejected
  // → Waiting). The keyboard shortcut j/k walks this single flat list; the
  // visual highlight re-maps the selected index back to whichever column the
  // selected report lives in.
  const allReviewableReports = useMemo<PhasedReport[]>(
    () => [...submitted, ...rejected, ...waiting],
    [submitted, rejected, waiting],
  );

  // Modal state
  const [selectedReport, setSelectedReport] = useState<PhasedReport | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Part 3 — keyboard shortcuts for the review console. The columns are
  // walked as a single flat list (Submitted → Rejected → Waiting). Enter
  // opens the Evaluate modal for the selected report. There is no `n`
  // (no create flow) or `f` (no search/filter on this page) shortcut.
  const { selectedIndex } = useListShortcuts({
    itemCount: allReviewableReports.length,
    onOpen: (index) => {
      const report = allReviewableReports[index];
      if (!report) return;
      setSelectedReport(report);
      setIsModalOpen(true);
    },
    onFilterFocus: null,
  });

  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    text: '',
    variant: 'success',
  });

  const openModal = (report: PhasedReport) => {
    setSelectedReport(report);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedReport(null);
  };

  const handleSubmitted = (
    action: EvaluationAction,
    _updated: PhasedReport,
  ) => {
    showBanner(
      action === 'approve'
        ? 'Report approved. Student can now see your feedback.'
        : 'Report rejected. The student may resubmit.',
      'success',
    );
    // Refresh the list — we don't merge the optimistically-updated row
    // because the BE may return an enriched shape (joined topic/group names).
    void loadReports();
  };

  const refreshAll = async () => {
    await Promise.all([refetchGroups(), loadReports()]);
  };

  const showBanner = (
    text: string,
    variant: 'success' | 'error' = 'success',
  ) => {
    setBanner({ visible: true, text, variant });
    window.setTimeout(
      () => setBanner({ visible: false, text: '', variant: 'success' }),
      4000,
    );
  };

  return (
    <div className={styles.evaluateReports}>
      <PageHeader
        eyebrow="LECTURER WORKSPACE"
        title="Phased Report Review Console"
        description="Review submissions from your research groups, approve or reject with feedback, and track waiting reports."
        actions={
          <Button
            variant="outline"
            size="md"
            className={styles.refreshBtn}
            leftIcon={
              isLoadingReports ? (
                <Loader size={14} className={styles.spinningIcon} aria-hidden />
              ) : (
                <RefreshCw size={14} aria-hidden />
              )
            }
            onClick={() => void refreshAll()}
            disabled={isLoadingGroups || isLoadingReports}
            aria-label="Refresh reports"
          >
            {isLoadingReports ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
        accent="var(--ars-lecturer)"
      />

      {/* Banner */}
      {banner.visible && (
        <div
          className={`${styles.banner} ${
            banner.variant === 'success' ? styles.bannerSuccess : styles.bannerError
          }`}
          role="status"
        >
          <span className={styles.bannerIcon}>
            {banner.variant === 'success' ? (
              <Check size={14} strokeWidth={3} aria-hidden />
            ) : (
              <AlertTriangle size={14} aria-hidden />
            )}
          </span>
          <span className={styles.bannerText}>{banner.text}</span>
          <button
            type="button"
            className={styles.bannerCloseBtn}
            onClick={() => setBanner({ visible: false, text: '', variant: 'success' })}
            aria-label="Dismiss"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {/* Global error banner */}
      {(groupsError || reportsError) && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.errorBannerIcon}>
            <AlertTriangle size={14} aria-hidden />
            <span>
              {groupsError?.message ?? reportsError ?? 'Failed to load data. Please retry.'}
            </span>
          </span>
          <button
            type="button"
            className={styles.errorRetryBtn}
            onClick={() => void refreshAll()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary tiles */}
      <div className={styles.summaryRow}>
        <SummaryTile
          label="Submitted (Awaiting Review)"
          count={submitted.length}
          tone="warning"
        />
        <SummaryTile label="Rejected (Resubmission Pending)" count={rejected.length} tone="danger" />
        <SummaryTile label="Waiting (No Submission Yet)" count={waiting.length} tone="info" />
        <SummaryTile
          label="Total Reviewable"
          count={reviewableReports.length}
          tone="primary"
        />
      </div>

      {/* Lists — one card per status */}
      <div className={styles.columnsGrid}>
        <ReportColumn
          title="Submitted"
          tone="warning"
          reports={submitted}
          isLoading={isLoadingReports || isLoadingGroups}
          groupNameById={groupNameById}
          onOpen={openModal}
          selectedIndex={
            selectedIndex < submitted.length ? selectedIndex : -1
          }
          flatOffset={0}
          emptyText="No submissions waiting for your review."
        />
        <ReportColumn
          title="Rejected (Resubmit Pending)"
          tone="danger"
          reports={rejected}
          isLoading={isLoadingReports || isLoadingGroups}
          groupNameById={groupNameById}
          onOpen={openModal}
          selectedIndex={
            selectedIndex >= submitted.length &&
            selectedIndex < submitted.length + rejected.length
              ? selectedIndex
              : -1
          }
          flatOffset={submitted.length}
          emptyText="No rejected reports awaiting a student resubmission."
        />
        <ReportColumn
          title="Waiting"
          tone="info"
          reports={waiting}
          isLoading={isLoadingReports || isLoadingGroups}
          groupNameById={groupNameById}
          onOpen={openModal}
          selectedIndex={
            selectedIndex >= submitted.length + rejected.length
              ? selectedIndex
              : -1
          }
          flatOffset={submitted.length + rejected.length}
          emptyText="No reports in the WAITING state."
        />
      </div>

      <EvaluateReportModal
        isOpen={isModalOpen}
        report={selectedReport}
        onClose={closeModal}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
};

interface SummaryTileProps {
  label: string;
  count: number;
  tone: 'primary' | 'warning' | 'danger' | 'info';
}

const SummaryTile = ({ label, count, tone }: SummaryTileProps) => {
  const toneClass = {
    primary: styles.tilePrimary,
    warning: styles.tileWarning,
    danger: styles.tileDanger,
    info: styles.tileInfo,
  }[tone];
  return (
    <div className={`${styles.tile} ${toneClass}`}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileCount}>{count}</span>
    </div>
  );
};

interface ReportColumnProps {
  title: string;
  tone: 'warning' | 'danger' | 'info';
  reports: PhasedReport[];
  isLoading: boolean;
  groupNameById: Map<number, string>;
  onOpen: (report: PhasedReport) => void;
  /**
   * The flat-list selected index in the parent (EvaluateReports) column
   * collection, or `-1` if the keyboard-selected report is not in this column.
   */
  selectedIndex: number;
  /**
   * Offset into the parent's flat list. The card's local index is
   * `parentSelectedIndex - flatOffset`.
   */
  flatOffset: number;
  emptyText: string;
}

const ReportColumn = ({
  title,
  tone,
  reports,
  isLoading,
  groupNameById,
  onOpen,
  selectedIndex,
  flatOffset,
  emptyText,
}: ReportColumnProps) => {
  const toneClass = {
    warning: styles.columnHeaderWarning,
    danger: styles.columnHeaderDanger,
    info: styles.columnHeaderInfo,
  }[tone];
  return (
    <div className={styles.column}>
      <div className={`${styles.columnHeader} ${toneClass}`}>
        <h3 className={styles.columnTitle}>{title}</h3>
        <span className={styles.columnCount}>{reports.length}</span>
      </div>
      <div className={styles.columnBody}>
        {isLoading ? (
          <div className={styles.columnLoading}>
            <Loader size={18} className={styles.spinningIcon} aria-hidden />
            <span>Loading…</span>
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<Inbox size={20} aria-hidden />}
            description={emptyText}
            compact
          />
        ) : (
          <ul className={styles.reportList}>
            {reports.map((r, index) => {
              const id = typeof r.id === 'number' ? r.id : '—';
              const groupName =
                typeof r.researchGroupId === 'number'
                  ? groupNameById.get(r.researchGroupId) ?? `Group #${r.researchGroupId}`
                  : 'Unassigned';
              const cardSelected = selectedIndex === flatOffset + index;
              const isOverdue = Boolean(
                r.submittedAt &&
                  r.deadlineAt &&
                  new Date(r.submittedAt) > new Date(r.deadlineAt),
              );
              return (
                <li
                  key={String(r.id)}
                  className={`${styles.reportCard} ${cardSelected ? styles.selectedCard : ''} ${isOverdue ? styles.overdueCard : ''}`}
                >
                  <div className={styles.reportCardTopRow}>
                    <StatusBadge status={r.status ?? 'WAITING'} />
                    <span className={styles.reportId}>#{id}</span>
                    {isOverdue && (
                      <span className={styles.overdueBadge} title="Submitted after the deadline">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className={styles.reportCardMeta}>
                    <span className={styles.metaLine}>
                      <Users size={12} aria-hidden />
                      {groupName}
                    </span>
                    <span className={isOverdue ? styles.overdueMeta : styles.metaLine}>
                      <Calendar size={12} aria-hidden />
                      Submitted {formatDate(r.submittedAt)}
                    </span>
                  </div>
                  {r.capacityEvaluation && (
                    <div className={styles.reportCardNote}>
                      <b>Rejection Reason:</b> {r.capacityEvaluation}
                    </div>
                  )}
                  {r.finalOutcomeEvaluation && (
                    <div className={styles.reportCardNote}>
                      <b>Outcome Notes:</b> {r.finalOutcomeEvaluation}
                    </div>
                  )}
                  <div className={styles.reportCardActions}>
                    {r.reportFileUrl ? (
                      <a
                        href={r.reportFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.viewFileBtn}
                      >
                        <FileText size={14} aria-hidden />
                        Open PDF
                      </a>
                    ) : (
                      <span className={styles.noFilePill}>No file uploaded</span>
                    )}
                    <button
                      type="button"
                      className={styles.evaluateBtn}
                      onClick={() => onOpen(r)}
                    >
                      <ClipboardCheck size={14} aria-hidden />
                      Evaluate
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default EvaluateReports;
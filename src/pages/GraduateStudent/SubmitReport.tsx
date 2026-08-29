/**
 * SubmitReport — Research Journey
 * ARS Research Constellation — Graduate Student workspace
 *
 * Guided, sectioned milestone submission page. Two-column layout:
 *  - Milestone Details (group, topic, lecturer, workspace label)
 *  - Artifact Submission (current report + submit button)
 *
 * Design rules applied:
 *  - PageHeader + role accent `--ars-gradstudent`
 *  - `EmptyState`, `ErrorBanner`, `SkeletonRow`, `Button` for shared surfaces
 *  - No inline styles in JSX (CSS Modules only)
 *  - The 5-phase dropdown is replaced by a single "Workspace label" text
 *    input (gap ticket §E.5). The label ONLY drives the Firebase folder
 *    path; it is not persisted in the milestone row.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  Inbox,
  Tag,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStudentGroups } from '../../hooks/useStudentGroups';
import { usePhasedReports } from '../../hooks/usePhasedReports';
import SubmitReportModal from '../../components/gradstudent/SubmitReportModal';
import RejectionFeedbackBanner from '../../components/gradstudent/RejectionFeedbackBanner';
import { getPrimaryMembershipId } from '../../components/gradstudent/utils';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button';
import styles from './SubmitReport.module.css';

const DEFAULT_FOLDER_KEY = 'milestone';
const ROLE_ACCENT = 'var(--ars-gradstudent)';

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' });
};

const normalizeWorkspaceLabel = (raw: string): string => {
  const cleaned = raw
    .normalize('NFKC')
    .replace(/[/\\?#%]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return cleaned.length > 0 ? cleaned : DEFAULT_FOLDER_KEY;
};

export const SubmitReport = (): JSX.Element => {
  const { user } = useAuth();
  const studentId = user?.userId ?? null;

  const {
    primaryGroup,
    primaryTopic,
    guidanceProject,
    joinedGroups,
    isLoading,
    error,
    refetch: refetchStudentGroups,
  } = useStudentGroups(studentId);

  const [workspaceLabel, setWorkspaceLabel] = useState<string>(
    DEFAULT_FOLDER_KEY,
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resubmitting, setResubmitting] = useState<SubmittedPhasedReport | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedPhasedReport | null>(null);

  const primaryGroupId = primaryGroup?.id ?? null;
  const { reports, isLoading: reportsLoading, refetch: refetchReports } =
    usePhasedReports(primaryGroupId);

  const lecturerId = guidanceProject?.lecturerId ?? primaryGroup?.lecturerId ?? null;

  const activePhaseReport = useMemo(() => {
    return reports
      .filter((r) => r.submittedAt !== undefined)
      .sort((a, b) => {
        const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bTime - aTime;
      })[0] ?? null;
  }, [reports]);

  const rejection = useMemo<SubmittedPhasedReport | null>(
    () => reports.find((r) => r.status === 'REJECTED') ?? null,
    [reports],
  );

  useEffect(() => {
    if (!submitting) {
      setResubmitting(null);
    }
  }, [submitting]);

  const handleSubmitted = async (report: SubmittedPhasedReport): Promise<void> => {
    setLastSubmitted(report);
    await Promise.all([refetchStudentGroups(), refetchReports()]);
  };

  const handleCloseSubmit = (): void => {
    setSubmitting(false);
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <ErrorBanner
          tone="error"
          message="Please sign in to submit a milestone report."
        />
      </div>
    );
  }

  const phaseKey = normalizeWorkspaceLabel(
    workspaceLabel.trim().length > 0
      ? workspaceLabel
      : (primaryTopic?.title ?? primaryGroup?.name ?? DEFAULT_FOLDER_KEY),
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="SUBMIT REPORT"
        title="Submit Milestone Research Report"
        description="Upload a PDF for review. Your lecturer will receive the file via secure storage and respond on the Reports tab."
        accent={ROLE_ACCENT}
      />

      {error ? (
        <ErrorBanner tone="error" message={error.message} />
      ) : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Milestone Details</h3>

          {isLoading ? (
            <SkeletonRow count={4} rowHeight={36} gap={12} />
          ) : !primaryGroup ? (
            <EmptyState
              icon={<Inbox size={24} />}
              title="No research group yet"
              description="Once a lecturer adds you to a group, you can submit milestones here."
              compact
            />
          ) : (
            <>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Assigned by</span>
                <span className={styles.detailVal}>
                  <Users size={12} />
                  {typeof lecturerId === 'number'
                    ? `Lecturer #${lecturerId}`
                    : 'Not assigned'}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Topic</span>
                <span className={styles.detailVal}>
                  <FileText size={12} />
                  {primaryTopic?.title ?? 'No topic assigned yet'}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Group</span>
                <span className={styles.detailVal}>
                  <Users size={12} />
                  {primaryGroup.name}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Deadline</span>
                <span className={styles.detailVal}>
                  <Calendar size={12} />
                  {primaryGroup.deadline
                    ? formatDate(primaryGroup.deadline)
                    : 'No deadline set'}
                </span>
              </div>

              <div className={styles.phasePicker}>
                <label className={styles.phaseLabel} htmlFor="workspace-label">
                  <Tag size={12} aria-hidden />
                  <span>Workspace label</span>
                </label>
                <input
                  id="workspace-label"
                  className={styles.phaseSelect}
                  type="text"
                  value={workspaceLabel}
                  placeholder={
                    primaryTopic?.title ??
                    primaryGroup.name ??
                    DEFAULT_FOLDER_KEY
                  }
                  onChange={(e) => setWorkspaceLabel(e.target.value)}
                  maxLength={64}
                />
                <span className={styles.phaseHint}>
                  Used only for the Firebase folder path — it is not persisted
                  in the milestone row.
                </span>
              </div>
            </>
          )}
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Artifact Submission</h3>

          {rejection ? (
            <RejectionFeedbackBanner
              report={rejection}
              onResubmit={(report) => {
                setResubmitting(report);
                setSubmitting(true);
              }}
            />
          ) : null}

          {reportsLoading ? (
            <SkeletonRow count={3} rowHeight={48} gap={12} />
          ) : activePhaseReport ? (
            <div className={styles.activeReportCard}>
              <div className={styles.activeReportHeader}>
                <span className={styles.activeReportTitle}>
                  <FileText size={14} />
                  Report #{activePhaseReport.id} — {activePhaseReport.status}
                </span>
                {activePhaseReport.reportFileUrl ? (
                  <a
                    href={activePhaseReport.reportFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.linkBtn}
                  >
                    Open current PDF
                  </a>
                ) : null}
              </div>
              <p className={styles.activeReportBody}>
                Submitted on{' '}
                {formatDate(activePhaseReport.submittedAt)}.
                {activePhaseReport.status === 'SUBMITTED' ? (
                  <>
                    {' '}Your lecturer is reviewing it. You&apos;ll be
                    notified when feedback is available.
                  </>
                ) : activePhaseReport.status === 'EVALUATED' ? (
                  <>
                    {' '}This milestone has been approved
                    {typeof activePhaseReport.lectureFeedback === 'number'
                      ? ` with a grade of ${activePhaseReport.lectureFeedback}/10`
                      : ''}
                    .
                  </>
                ) : activePhaseReport.status === 'REJECTED' ? (
                  <>
                    {' '}See the rejection banner above for the lecturer&apos;s
                    feedback. Use <strong>Resubmit</strong> to upload a revised
                    version.
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <EmptyState
              icon={<Clock size={24} />}
              title="No prior submission"
              description="Click Submit report below to upload your first PDF for this group."
              compact
            />
          )}

          <div className={styles.actionCenter}>
            <Button
              variant="primary"
              size="md"
              leftIcon={<FileText size={14} />}
              onClick={() => setSubmitting(true)}
              disabled={!primaryGroup || isLoading}
            >
              {activePhaseReport ? 'Update submission' : 'Submit report'}
            </Button>
          </div>

          {lastSubmitted ? (
            <p className={styles.successHint} role="status">
              <Clock size={12} />
              Last successful submission: Report #{lastSubmitted.id}
              {' · '}
              {formatDate(lastSubmitted.submittedAt)}
            </p>
          ) : null}
        </section>
      </div>

      {submitting && primaryGroup ? (
        <SubmitReportModal
          isOpen={submitting}
          researchGroupId={primaryGroup.id}
          groupMemberId={getPrimaryMembershipId(joinedGroups) ?? undefined}
          phaseKey={phaseKey}
          phaseTitle={
            primaryTopic?.title ??
            primaryGroup.name ??
            `Group #${primaryGroup.id}`
          }
          {...(typeof lecturerId === 'number'
            ? { lecturerName: `Lecturer #${lecturerId}` }
            : {})}
          resubmittingReport={resubmitting}
          isSubmitting={false}
          lastSubmitted={lastSubmitted}
          onClose={handleCloseSubmit}
          onSubmitted={handleSubmitted}
        />
      ) : null}
    </div>
  );
};

export default SubmitReport;
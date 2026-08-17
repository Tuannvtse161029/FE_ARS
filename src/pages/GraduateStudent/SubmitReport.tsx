import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Clock,
  FileText,
  Inbox,
  Loader2,
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
import styles from './SubmitReport.module.css';

// Real-data rewrite of the Submit Report page. Per
// docs/local-only/research-workflow-contract.md and the Phase C contract
// G3 + G6:
//
//   - The 5-phase dropdown is replaced by a single "Workspace label" text
//     input. The input ONLY drives the Firebase folder path
//     (`research-groups/{groupId}/phased-reports/{label}/`) — there is no
//     persisted `phase` column on `PhasedReports` (gap ticket §E.5).
//   - `groupMemberId` is sourced from `joinedGroups[].membershipId` via the
//     shared `getPrimaryMembershipId` helper (G1).
//   - After a successful submit or resubmit, the page refreshes BOTH the
//     student-groups state AND the phased-reports list so the table reflects
//     the new row immediately (G6(c)).
//   - Rejection banner still renders from the latest REJECTED report of the
//     active group.

const DEFAULT_FOLDER_KEY = 'milestone';

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' });
};

// Workspace label normalization — Firebase folder paths must avoid `/`,
// whitespace, and non-ASCII to remain portable. We never strip the user's
// intent; we just produce a safe folder segment.
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
    // Most recent report submitted for THIS group (across status types).
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

  // Reset resubmit + lastSubmitted state when the modal closes.
  useEffect(() => {
    if (!submitting) {
      setResubmitting(null);
    }
  }, [submitting]);

  const handleSubmitted = async (report: SubmittedPhasedReport): Promise<void> => {
    setLastSubmitted(report);
    // G6(c): refresh both student-groups (the new submission may have changed
    // membership activity timestamps etc.) and phased-reports (so the table
    // below this card picks up the new row immediately).
    await Promise.all([refetchStudentGroups(), refetchReports()]);
  };

  const handleCloseSubmit = (): void => {
    setSubmitting(false);
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBanner}>
          <AlertCircle size={16} />
          <span>Please sign in to submit a milestone report.</span>
        </div>
      </div>
    );
  }

  // The folder key ONLY drives the Firebase path; the page derives a sensible
  // default from what the student can see (primary topic title, then group
  // name, then a generic "milestone" fallback). The user can override via the
  // "Workspace label" input — useful when a group has multiple submissions
  // for the same topic and the student wants to keep them segregated in
  // storage (e.g. "draft-v2" vs "draft-v3").
  const phaseKey = normalizeWorkspaceLabel(
    workspaceLabel.trim().length > 0
      ? workspaceLabel
      : (primaryTopic?.title ?? primaryGroup?.name ?? DEFAULT_FOLDER_KEY),
  );

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumbs}>
        Home &gt; Collaborative Workspace &gt;{' '}
        {primaryGroup?.name ?? 'Research Group'} &gt;{' '}
        <span className={styles.activeBreadcrumb}>Submit Report</span>
      </nav>

      <header className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Submit Milestone Research Report</h1>
          <p className={styles.pageSubtitle}>
            Upload a PDF for review. Your lecturer will receive the file via
            secure storage and respond on the Reports tab.
          </p>
        </div>
      </header>

      {error ? (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>{error.message}</span>
        </div>
      ) : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Milestone Details</h3>

          {isLoading ? (
            <div className={styles.detailRow}>
              <Loader2 size={14} className={styles.spin} />
              <span>Loading your context…</span>
            </div>
          ) : !primaryGroup ? (
            <div className={styles.emptyState}>
              <Inbox size={18} />
              <span>
                You haven&apos;t joined a research group yet. Once a lecturer
                adds you to one, you can submit milestones here.
              </span>
            </div>
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
            <div className={styles.detailRow}>
              <Loader2 size={14} className={styles.spin} />
              <span>Loading previous reports…</span>
            </div>
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
                    {' '}Your lecturer is is reviewing it. You&apos;ll be notified
                    when feedback is available.
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
            <div className={styles.emptyState}>
              <Clock size={18} />
              <span>
                No prior submission for this group yet. Click{' '}
                <strong>Submit report</strong> below to upload your first PDF.
              </span>
            </div>
          )}

          <div className={styles.actionCenter}>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => setSubmitting(true)}
              disabled={!primaryGroup || isLoading}
            >
              <FileText size={14} />
              <span>
                {activePhaseReport ? 'Update submission' : 'Submit report'}
              </span>
            </button>
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
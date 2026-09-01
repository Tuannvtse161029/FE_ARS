import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Clock,
  FileText,
  Inbox,
  Loader2,
  Users,
  Crown,
  CheckCircle2,
  ExternalLink,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStudentGroups } from '../../hooks/useStudentGroups';
import { usePhasedReports } from '../../hooks/usePhasedReports';
import SubmitReportModal from '../../components/gradstudent/SubmitReportModal';
import RejectionFeedbackBanner from '../../components/gradstudent/RejectionFeedbackBanner';
import { getPrimaryMembershipId } from '../../components/gradstudent/utils';
import {
  phasedReportService,
  type PhasedReport,
  type SubmittedPhasedReport,
} from '../../services/phasedReport.service';
import type { GroupMember } from '../../services/groupMember.service';
import styles from './SubmitReport.module.css';

const DEFAULT_FOLDER_KEY = 'milestone';

const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [targetPhase, setTargetPhase] = useState<{
    phaseNumber: number;
    phasedReportId?: number;
    title: string;
  } | null>(null);

  const [resubmitting, setResubmitting] = useState<SubmittedPhasedReport | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedPhasedReport | null>(null);

  const primaryGroupId = primaryGroup?.id ?? null;
  const topicId = primaryTopic?.id ?? primaryGroup?.topicId ?? null;

  const { refetch: refetchReports } = usePhasedReports(primaryGroupId);

  const [topicPhases, setTopicPhases] = useState<PhasedReport[]>([]);
  const [topicMembers, setTopicMembers] = useState<GroupMember[]>([]);
  const [isLoadingTopicDetails, setIsLoadingTopicDetails] = useState<boolean>(false);

  const lecturerId = guidanceProject?.lecturerId ?? primaryGroup?.lecturerId ?? null;

  // Load 5 topic phases & members when topicId is available
  const loadTopicDetails = async (tId: number) => {
    setIsLoadingTopicDetails(true);
    try {
      const [phases, members] = await Promise.all([
        phasedReportService.getByTopic(tId).catch(() => []),
        phasedReportService.getMembersByTopic(tId).catch(() => []),
      ]);
      setTopicPhases(phases);
      setTopicMembers(members);
    } catch {
      // ignore
    } finally {
      setIsLoadingTopicDetails(false);
    }
  };

  useEffect(() => {
    if (topicId) {
      void loadTopicDetails(topicId);
    }
  }, [topicId]);

  // Determine leader information
  const leaderMember = useMemo(() => {
    return topicMembers.find((m) => m.isLeader) ?? null;
  }, [topicMembers]);

  const isCurrentUserLeader = useMemo(() => {
    if (!studentId) return false;
    const current = topicMembers.find((m) => m.studentId === studentId);
    if (current?.isLeader) return true;
    // Fallback check on joinedGroups
    const joined = joinedGroups.find((g) => g.id === primaryGroupId);
    return Boolean(joined?.membershipId && leaderMember?.studentId === studentId);
  }, [studentId, topicMembers, joinedGroups, primaryGroupId, leaderMember]);

  const currentMembershipId = useMemo(() => {
    if (!studentId) return undefined;
    const current = topicMembers.find((m) => m.studentId === studentId);
    return current?.groupMemberId ?? current?.id ?? getPrimaryMembershipId(joinedGroups) ?? undefined;
  }, [studentId, topicMembers, joinedGroups]);

  const rejection = useMemo<SubmittedPhasedReport | null>(() => {
    const found = topicPhases.find((r) => r.status === 'REJECTED' || r.status === 'Rejected');
    if (!found) return null;
    return {
      id: found.phasedReportId || found.id || 0,
      researchGroupId: found.researchGroupId || primaryGroupId || 0,
      groupMemberId: found.groupMemberId ?? undefined,
      reportFileUrl: found.reportFileUrl ?? undefined,
      capacityEvaluation: found.capacityEvaluation ?? undefined,
      finalOutcomeEvaluation: found.finalOutcomeEvaluation ?? undefined,
      lectureFeedback: found.lectureFeedback ?? undefined,
      submittedAt: found.submittedAt ?? undefined,
      status: 'REJECTED',
    };
  }, [topicPhases, primaryGroupId]);

  useEffect(() => {
    if (!submitting) {
      setResubmitting(null);
      setTargetPhase(null);
    }
  }, [submitting]);

  const handleSubmitted = async (report: SubmittedPhasedReport): Promise<void> => {
    setLastSubmitted(report);
    await Promise.all([
      refetchStudentGroups(),
      refetchReports(),
      topicId ? loadTopicDetails(topicId) : Promise.resolve(),
    ]);
  };

  const handleOpenPhaseSubmit = (phaseNumber: number, phasedReportId?: number, title?: string) => {
    setTargetPhase({
      phaseNumber,
      phasedReportId,
      title: title || `Phase ${phaseNumber}`,
    });
    setSubmitting(true);
  };

  const handleCloseSubmit = (): void => {
    setSubmitting(false);
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBanner}>
          <AlertCircle size={16} />
          <span>Please sign in to view and submit research reports.</span>
        </div>
      </div>
    );
  }

  const phaseKey = normalizeWorkspaceLabel(
    targetPhase?.title ??
      primaryTopic?.title ??
      primaryGroup?.name ??
      DEFAULT_FOLDER_KEY,
  );

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'Passed':
        return { className: styles.statusPassed, label: 'Passed' };
      case 'OnTime':
        return { className: styles.statusOnTime, label: 'On time' };
      case 'Overdue':
        return { className: styles.statusOverdue, label: 'Overdue' };
      case 'Rejected':
        return { className: styles.statusRejected, label: 'Rejected' };
      default:
        return { className: styles.statusPending, label: 'Pending' };
    }
  };

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumbs}>
        Home &gt; Collaborative Workspace &gt;{' '}
        {primaryGroup?.name ?? 'Research Group'} &gt;{' '}
        <span className={styles.activeBreadcrumb}>Submit Progress Report</span>
      </nav>

      <header className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Submit Research Report by Phase</h1>
          <p className={styles.pageSubtitle}>
            Track 5 progress milestones for your topic and submit reports on schedule. Your supervisor will review and respond directly.
          </p>
        </div>
      </header>

      {error ? (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>{error.message}</span>
        </div>
      ) : null}

      {primaryGroup && (
        <section
          className={`${styles.leaderNotice} ${
            isCurrentUserLeader ? styles.leaderNoticeActive : styles.leaderNoticeRestricted
          }`}
          aria-labelledby="leader-permission-title"
        >
          <Crown size={18} aria-hidden />
          <div>
            <h2 id="leader-permission-title" className={styles.leaderNoticeTitle}>
              {isCurrentUserLeader
                ? 'You are the group leader'
                : 'Report submission is limited to the group leader'}
            </h2>
            <p className={styles.leaderNoticeText}>
              {isCurrentUserLeader
                ? 'You can submit reports for phases 1 through 5. Each submission is sent to your lecturer for review.'
                : leaderMember
                  ? `${leaderMember.studentName || `Student #${leaderMember.studentId}`} is responsible for uploads. Contact them or your lecturer if the group leader needs to change.`
                  : 'Ask your lecturer to assign a group leader before your group can submit a milestone report.'}
            </p>
          </div>
        </section>
      )}

      <div className={styles.grid}>
        {/* Topic & Group Info */}
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Topic &amp; group information</h3>

          {isLoading ? (
            <div className={styles.detailRow}>
              <Loader2 size={14} className={styles.spin} />
              <span>Loading group information…</span>
            </div>
          ) : !primaryGroup ? (
            <div className={styles.emptyState}>
              <Inbox size={18} />
              <span>
                You haven't joined a research group yet. When a lecturer assigns you to a group, you'll be able to submit reports here.
              </span>
            </div>
          ) : (
            <>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Supervisor</span>
                <span className={styles.detailVal}>
                  <Users size={12} />
                  {typeof lecturerId === 'number'
                    ? `Lecturer #`
                    : 'Not assigned yet'}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Topic</span>
                <span className={styles.detailVal}>
                  <FileText size={12} />
                  {primaryTopic?.title ?? `Unassigned topic`}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Research group</span>
                <span className={styles.detailVal}>
                  <Users size={12} />
                  {primaryGroup.name}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Project deadline</span>
                <span className={styles.detailVal}>
                  <Calendar size={12} />
                  {primaryGroup.deadline
                    ? formatDate(primaryGroup.deadline)
                    : 'No deadline set'}
                </span>
              </div>
            </>
          )}
        </section>

        {/* Phase Report List */}
        <section className={`${styles.card} ${styles.milestonesCard}`}>
          <h2 className={styles.cardTitle}>Phase report milestones</h2>

          {rejection ? (
            <RejectionFeedbackBanner
              report={rejection}
              onResubmit={(report) => {
                setResubmitting(report);
                setSubmitting(true);
              }}
            />
          ) : null}

          {isLoadingTopicDetails ? (
            <div className={styles.detailRow}>
              <Loader2 size={14} className={styles.spin} />
              <span>Loading phase milestones…</span>
            </div>
          ) : topicPhases.length === 0 ? (
            <div className={styles.emptyState}>
              <Clock size={18} />
              <span>
                Your supervisor has not configured any phase milestones for this topic yet. Ask them to set up milestones so your group can begin submitting reports.
              </span>
            </div>
          ) : (
            <div className={styles.phaseList}>
              {topicPhases.map((phase) => {
                const pNum = phase.phaseNumber ?? 1;
                const status = getStatusBadge(phase.status);
                const isPassed = phase.status === 'Passed';
                const hasFile = Boolean(phase.reportFileUrl);

                return (
                  <article
                    key={`phase-${phase.phasedReportId || pNum}`}
                    className={`${styles.phaseCard} ${
                      isPassed ? styles.phaseCardPassed : ''
                    }`}
                  >
                    <div className={styles.phaseHeader}>
                      <div className={styles.phaseIdentity}>
                        <span
                          className={`${styles.phaseNumber} ${
                            isPassed ? styles.phaseNumberPassed : ''
                          }`}
                          aria-label={`Phase ${pNum}`}
                        >
                          {pNum}
                        </span>
                        <h3 className={styles.phaseTitle}>
                          {phase.milestoneTitle || `Phase ${pNum}`}
                        </h3>
                      </div>

                      <div className={styles.phaseStatusRow}>
                        <span className={`${styles.statusBadge} ${status.className}`}>
                          {status.label}
                        </span>
                        {phase.lectureFeedback != null && (
                          <span className={styles.gradeText}>
                            Grade: {phase.lectureFeedback}/10
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.phaseMetadata}>
                      <p><strong>Deadline:</strong> {formatDate(phase.deadlineAt)}</p>
                      {phase.submittedAt && (
                        <p><strong>Submitted at:</strong> {formatDate(phase.submittedAt)}</p>
                      )}
                    </div>

                    {hasFile && (
                      <div className={styles.submittedFile}>
                        <FileText size={14} aria-hidden />
                        <span>Submitted report file:</span>
                        <a
                          href={phase.reportFileUrl!}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.fileLink}
                        >
                          View PDF <ExternalLink size={12} aria-hidden />
                        </a>
                      </div>
                    )}

                    {phase.lecturerDescription && (
                      <div className={styles.feedbackNote}>
                        <strong>Lecturer feedback:</strong> {phase.lecturerDescription}
                      </div>
                    )}

                    <div className={styles.phaseActionRow}>
                      {isPassed ? (
                        <span className={styles.completedState}>
                          <CheckCircle2 size={16} aria-hidden /> Phase complete
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.submitPhaseButton}
                            onClick={() => handleOpenPhaseSubmit(pNum, phase.phasedReportId, phase.milestoneTitle || undefined)}
                            disabled={!isCurrentUserLeader}
                            aria-describedby={
                              isCurrentUserLeader ? undefined : `phase-${pNum}-permission`
                            }
                          >
                            <Upload size={14} aria-hidden />
                            {hasFile ? 'Resubmit report' : 'Submit report'}
                          </button>
                          {!isCurrentUserLeader ? (
                            <p id={`phase-${pNum}-permission`} className={styles.actionExplanation}>
                              Only your Group Leader can submit this phase report. Contact your lecturer to update the group leader.
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {submitting && primaryGroup ? (
        <SubmitReportModal
          isOpen={submitting}
          researchGroupId={primaryGroup.id}
          groupMemberId={currentMembershipId}
          topicId={topicId ?? undefined}
          phaseNumber={targetPhase?.phaseNumber}
          phasedReportId={targetPhase?.phasedReportId}
          phaseKey={phaseKey}
          phaseTitle={
            targetPhase?.title ??
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

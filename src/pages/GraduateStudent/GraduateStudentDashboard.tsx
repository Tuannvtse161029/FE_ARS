/**
 * GraduateStudentDashboard — Research Journey
 * ARS Research Constellation — Graduate Student Landing Page
 *
 * Features:
 * - Large progress timeline showing research milestones
 * - Current milestone with lecturer feedback
 * - Role-specific slate-blue accent
 * - Section markers, editorial typography, minimal motion
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Inbox,
  Layers,
  Loader2,
  Microscope,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStudentGroups } from '../../hooks/useStudentGroups';
import { usePhasedReports } from '../../hooks/usePhasedReports';
import InvitationBanner from '../../components/gradstudent/InvitationBanner';
import RejectionFeedbackBanner from '../../components/gradstudent/RejectionFeedbackBanner';
import SubmitReportModal from '../../components/gradstudent/SubmitReportModal';
import { getPrimaryMembershipId } from '../../components/gradstudent/utils';
import {
  lecturerLookupService,
} from '../../services/lecturerLookup.service';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDate';
import type {
  GuidanceProjectStatus,
  PhasedReportStatus,
} from '../../types/research';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';
import { WorkspaceHeader } from '../../components/workspace/WorkspaceHeader';
import { MetricCard } from '../../components/workspace/MetricCard';
import { ActivityFeed, type ActivityEntry } from '../../components/workspace/ActivityFeed';
import styles from './GraduateStudentDashboard.module.css';

// Default folder key for Firebase uploads.
const DEFAULT_FOLDER_KEY = 'milestone';

// Role accent
const ROLE_ACCENT = 'var(--ars-gradstudent)';

const GUIDANCE_STATUS_PALETTE: Record<GuidanceProjectStatus, string> = {
  PROPOSED: styles.statusSubmitted,
  ONGOING: styles.statusWaiting,
  COMPLETED: styles.statusEvaluated,
  CANCELLED: styles.statusRejected,
};

export const GraduateStudentDashboard = (): JSX.Element => {
  const { user } = useAuth();
  const studentId = user?.userId ?? null;

  const {
    guidanceProject,
    joinedGroups,
    primaryGroup,
    primaryTopic,
    isLoading,
    error,
    refetch,
  } = useStudentGroups(studentId);
  const primaryGroupId = primaryGroup?.id ?? null;
  const {
    reports,
    isLoading: reportsLoading,
    refetch: refetchReports,
    latestByStatus,
  } = usePhasedReports(primaryGroupId);

  const [invitation] = useState<null | {
    id: string;
    lecturerName: string;
    groupName: string;
    topicTitle?: string;
    sentAt?: string;
  }>(null);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resubmitting, setResubmitting] = useState<SubmittedPhasedReport | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedPhasedReport | null>(null);

  const [lecturerNames, setLecturerNames] = useState<Record<number, string>>({});

  const lecturerId = guidanceProject?.lecturerId ?? primaryGroup?.lecturerId ?? null;

  useEffect(() => {
    if (typeof lecturerId === 'number' && lecturerId > 0) {
      lecturerLookupService.ensureLecturerDisplayName(lecturerId);
    }
  }, [lecturerId]);

  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<{ lecturerId: number }>).detail;
      if (!detail) return;
      const name = lecturerLookupService.getLecturerDisplayName(detail.lecturerId);
      setLecturerNames((prev) => ({ ...prev, [detail.lecturerId]: name }));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'ars:lecturer-name-resolved',
        handler as EventListener,
      );
      return () => {
        window.removeEventListener(
          'ars:lecturer-name-resolved',
          handler as EventListener,
        );
      };
    }
    return undefined;
  }, []);

  const lecturerName = useMemo(() => {
    if (typeof lecturerId !== 'number' || lecturerId <= 0) {
      return 'Not yet assigned';
    }
    const cached = lecturerNames[lecturerId];
    if (cached) return cached;
    return lecturerLookupService.getLecturerDisplayName(lecturerId);
  }, [lecturerId, lecturerNames]);

  const currentMilestone = useMemo<SubmittedPhasedReport | null>(() => {
    const rejected = latestByStatus('REJECTED');
    if (rejected) return rejected;
    return latestByStatus('SUBMITTED');
  }, [latestByStatus]);

  const recentActivity = useMemo<ActivityEntry[]>(() => {
    const sorted = [...reports].sort((a, b) => {
      const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bTime - aTime;
    });
    return sorted.slice(0, 6).map((report) => ({
      id: String(report.id),
      title: `Report #${report.id}`,
      meta: report.status,
      time: report.submittedAt ? formatRelativeTime(report.submittedAt) : undefined,
      tag: <StatusBadgeInline status={report.status} />,
      onClick: report.reportFileUrl
        ? () => window.open(report.reportFileUrl!, '_blank', 'noopener,noreferrer')
        : undefined,
    }));
  }, [reports]);

  const handleRefresh = async (): Promise<void> => {
    await Promise.all([refetch(), refetchReports()]);
  };

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handler = (): void => {
      if (document.visibilityState === 'visible') {
        void handleRefresh();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcceptInvitation = (): void => {};
  const handleDeclineInvitation = (): void => {};
  const handleResubmit = (report: SubmittedPhasedReport): void => {
    setResubmitting(report);
    setSubmitting(true);
  };
  const handleSubmitted = (report: SubmittedPhasedReport): void => {
    setLastSubmitted(report);
    void refetchReports();
  };
  const handleCloseSubmit = (): void => {
    setSubmitting(false);
    setResubmitting(null);
  };

  // Loading skeleton
  if (!user) {
    return (
      <div className={styles.page}>
        <WorkspaceHeader
          marker="01 / RESEARCH JOURNEY"
          title="Graduate Student Workspace"
          subtitle="Please sign in to view your workspace."
          accent={ROLE_ACCENT}
        />
      </div>
    );
  }

  if (isLoading && !guidanceProject && joinedGroups.length === 0) {
    return (
      <div className={styles.page}>
        <WorkspaceHeader
          marker="01 / RESEARCH JOURNEY"
          title="Graduate Student Workspace"
          subtitle={`Welcome back, ${user.username}. Loading your research journey…`}
          accent={ROLE_ACCENT}
          annotation="Loading research data…"
        />
        <div className={styles.loadingGrid}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.metricSkeleton} />
          ))}
        </div>
      </div>
    );
  }

  // Build metric cards data
  const metricCards = [
    {
      label: 'Guidance Project',
      value: guidanceProject?.title ?? 'No active project',
      annotation: guidanceProject?.status
        ? `Status: ${guidanceProject.status}`
        : 'Awaiting lecturer confirmation',
      icon: <Microscope size={16} />,
      empty: !guidanceProject,
    },
    {
      label: 'Supervising Lecturer',
      value: lecturerName,
      annotation: primaryGroup?.name ? `Group: ${primaryGroup.name}` : 'No group joined yet',
      icon: <Users size={16} />,
      empty: !lecturerId && !primaryGroup,
    },
    {
      label: 'Assigned Topic',
      value: primaryTopic?.title ?? 'No topic assigned',
      annotation: primaryTopic?.status ? `Status: ${primaryTopic.status}` : 'Awaiting lecturer assignment',
      icon: <FileText size={16} />,
      empty: !primaryTopic,
    },
    {
      label: 'Joined Groups',
      value: `${joinedGroups.length} active`,
      annotation: joinedGroups[0] ? `Most recent: ${joinedGroups[0].name}` : 'Join a research group to begin',
      icon: <Layers size={16} />,
      empty: joinedGroups.length === 0,
    },
  ];

  return (
    <div className={styles.page}>
      {/* ── Workspace Header ──────────────────────────────── */}
      <WorkspaceHeader
        marker="01 / RESEARCH JOURNEY"
        title={`${user.username}'s Research Journey`}
        subtitle="Track your guidance project, milestones, and lecturer feedback."
        accent={ROLE_ACCENT}
        annotation={`Lecturer: ${lecturerName}`}
        actions={
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={isLoading || reportsLoading}
            aria-label="Refresh dashboard"
          >
            {isLoading || reportsLoading ? (
              <Loader2 size={13} className={styles.spin} />
            ) : (
              <RefreshCw size={13} />
            )}
            <span>Refresh</span>
          </button>
        }
      />

      <div className={styles.content}>
        {/* ── Invitation Banner ─────────────────────────── */}
        {invitation ? (
          <InvitationBanner
            invitation={invitation}
            onAccept={handleAcceptInvitation}
            onDecline={handleDeclineInvitation}
          />
        ) : null}

        {/* ── Error Banner ──────────────────────────────── */}
        {error ? (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={14} />
            <span>{error.message}</span>
          </div>
        ) : null}

        {/* ── Metric Cards ──────────────────────────────── */}
        <div className={styles.metricGrid}>
          {metricCards.map((card, i) => (
            <div key={i} className={`${styles.metricWrapper} ${card.empty ? styles.metricWrapperEmpty : ''}`}>
              <MetricCard
                label={card.label}
                value={card.value}
                annotation={card.annotation}
                icon={card.icon}
                accent={ROLE_ACCENT}
              />
            </div>
          ))}
        </div>

        {/* ── Two-column layout: Milestone + Activity ─────── */}
        <div className={styles.twoCol}>
          {/* Left: Guidance Project Card */}
          <GuidanceProjectCard
            guidanceProject={guidanceProject}
            isLoading={reportsLoading}
            lecturerName={lecturerName}
            hasGroup={joinedGroups.length > 0}
            hasTopic={primaryTopic !== null}
            onOpenSubmit={() => setSubmitting(true)}
            currentMilestone={currentMilestone}
            onResubmit={handleResubmit}
          />

          {/* Right: Activity Timeline */}
          <div className={styles.rightCol}>
            <ActivityFeed
              marker="02 / SUBMISSION LOG"
              title="Recent Milestones"
              entries={recentActivity}
              loading={reportsLoading && reports.length === 0}
              emptyMessage="No submissions recorded yet."
            />

            {/* Current status callout */}
            {guidanceProject?.status === 'ONGOING' && currentMilestone && (
              <div className={styles.statusCallout}>
                <div className={styles.calloutHeader}>
                  <span className={styles.calloutMarker}>CURRENT STATUS</span>
                </div>
                <div className={styles.calloutBody}>
                  {currentMilestone.status === 'REJECTED' ? (
                    <p className={styles.calloutText}>
                      Your latest submission was returned for revision.
                      Review the feedback and resubmit when ready.
                    </p>
                  ) : currentMilestone.status === 'SUBMITTED' ? (
                    <p className={styles.calloutText}>
                      Submitted on{' '}
                      {currentMilestone.submittedAt
                        ? formatDateTime(currentMilestone.submittedAt)
                        : 'an unknown date'}
                      . Awaiting lecturer feedback.
                    </p>
                  ) : currentMilestone.status === 'EVALUATED' ? (
                    <p className={styles.calloutText}>
                      Milestone approved
                      {typeof currentMilestone.lectureFeedback === 'number'
                        ? ` with a grade of ${currentMilestone.lectureFeedback}/10`
                        : ''}
                      . Submit your next milestone when ready.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit Report Modal */}
      {submitting && primaryGroup ? (
        <SubmitReportModal
          isOpen={submitting}
          researchGroupId={primaryGroup.id}
          groupMemberId={getPrimaryMembershipId(joinedGroups) ?? undefined}
          phaseKey={DEFAULT_FOLDER_KEY}
          phaseTitle={
            primaryTopic?.title ??
            primaryGroup.name ??
            `Group #${primaryGroup.id}`
          }
          {...(typeof lecturerId === 'number'
            ? { lecturerName }
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

// ── Sub-components ────────────────────────────────────────────────

function StatusBadgeInline({ status }: { status: PhasedReportStatus }): JSX.Element {
  const palette: Record<PhasedReportStatus, string> = {
    WAITING: styles.statusInlineWaiting,
    SUBMITTED: styles.statusInlineSubmitted,
    EVALUATED: styles.statusInlineEvaluated,
    REJECTED: styles.statusInlineRejected,
    Pending: styles.statusInlineWaiting,
    OnTime: styles.statusInlineSubmitted,
    Overdue: styles.statusInlineRejected,
    Passed: styles.statusInlineEvaluated,
  };
  return (
    <span className={`${styles.statusInline} ${palette[status]}`}>
      {status}
    </span>
  );
}

interface GuidanceProjectCardProps {
  guidanceProject: import('../../types/research').GuidanceProject | null;
  isLoading: boolean;
  lecturerName: string;
  hasGroup: boolean;
  hasTopic: boolean;
  onOpenSubmit: () => void;
  currentMilestone: SubmittedPhasedReport | null;
  onResubmit: (report: SubmittedPhasedReport) => void;
}

function GuidanceProjectCard({
  guidanceProject,
  isLoading: _isLoading,
  lecturerName,
  hasGroup,
  hasTopic,
  onOpenSubmit,
  currentMilestone,
  onResubmit,
}: GuidanceProjectCardProps): JSX.Element {

  if (!guidanceProject) {
    return (
      <section className={styles.projectCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardMarker}>02 / GUIDANCE PROJECT</span>
          <h2 className={styles.cardTitle}>Current Project</h2>
        </div>
        <div className={styles.emptyCard}>
          <Inbox size={18} />
          <span>
            You don&apos;t have an active guidance project. Once a lecturer
            invites you, a card will appear here.
          </span>
        </div>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled
          aria-disabled="true"
          title="Request supervision is not yet available — the Grad-initiated POST endpoint is on the BE gap ticket (§D.3)."
        >
          <HelpCircle size={13} />
          <span>Request supervision</span>
        </button>
      </section>
    );
  }

  // PROPOSED
  if (guidanceProject.status === 'PROPOSED') {
    return (
      <section className={styles.projectCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardMarker}>02 / GUIDANCE PROJECT</span>
          <h2 className={styles.cardTitle}>{guidanceProject.title}</h2>
        </div>
        <span className={`${styles.statusBadge} ${GUIDANCE_STATUS_PALETTE.PROPOSED}`}>
          PROPOSED
        </span>
        <div className={styles.infoCard}>
          <Clock size={14} className={styles.infoIcon} />
          <div>
            <p className={styles.infoTitle}>Awaiting lecturer confirmation</p>
            <p className={styles.infoBody}>
              Your lecturer ({lecturerName}) has proposed this guidance project.
              They will move it to ONGOING once both of you agree on milestones.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled
          aria-disabled="true"
          title="Withdraw is disabled in the PROPOSED state."
        >
          Withdraw
        </button>
      </section>
    );
  }

  // ONGOING
  if (guidanceProject.status === 'ONGOING') {
    return (
      <section className={styles.projectCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardMarker}>02 / CURRENT MILESTONE</span>
          <h2 className={styles.cardTitle}>{guidanceProject.title}</h2>
          <p className={styles.cardSubtitle}>Supervised by {lecturerName}</p>
        </div>
        <span className={`${styles.statusBadge} ${GUIDANCE_STATUS_PALETTE.ONGOING}`}>
          ONGOING
        </span>

        {currentMilestone?.status === 'REJECTED' ? (
          <RejectionFeedbackBanner
            report={currentMilestone}
            onResubmit={(report) => {
              onResubmit(report);
            }}
          />
        ) : currentMilestone?.status === 'SUBMITTED' ? (
          <div className={styles.infoCard}>
            <Clock size={14} className={styles.infoIcon} />
            <div>
              <p className={styles.infoTitle}>Awaiting lecturer review</p>
              <p className={styles.infoBody}>
                Submitted on{' '}
                {currentMilestone.submittedAt
                  ? formatDateTime(currentMilestone.submittedAt)
                  : 'an unknown date'}
                . You will be notified once feedback is available.
              </p>
            </div>
          </div>
        ) : currentMilestone?.status === 'EVALUATED' ? (
          <div className={styles.successCard}>
            <CheckCircle2 size={14} className={styles.successIcon} />
            <div>
              <p className={styles.successTitle}>Milestone approved</p>
              <p className={styles.successBody}>
                Report #{currentMilestone.id} was approved
                {typeof currentMilestone.lectureFeedback === 'number'
                  ? ` with a grade of ${currentMilestone.lectureFeedback}/10`
                  : ''}
                .
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.emptyCard}>
            <Calendar size={18} />
            <span>
              No active milestone. Click <strong>Submit milestone</strong> to
              upload your first report.
            </span>
          </div>
        )}

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onOpenSubmit}
            disabled={!hasGroup || !hasTopic}
            aria-label="Submit milestone report"
          >
            <FileText size={13} />
            <span>{currentMilestone ? 'Update submission' : 'Submit milestone'}</span>
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled
            aria-disabled="true"
            title="Withdraw is disabled in this build."
          >
            Withdraw
          </button>
        </div>
      </section>
    );
  }

  // COMPLETED
  if (guidanceProject.status === 'COMPLETED') {
    return (
      <section className={styles.projectCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardMarker}>02 / GUIDANCE PROJECT</span>
          <h2 className={styles.cardTitle}>{guidanceProject.title}</h2>
        </div>
        <span className={`${styles.statusBadge} ${GUIDANCE_STATUS_PALETTE.COMPLETED}`}>
          COMPLETED
        </span>
        <div className={styles.successCard}>
          <CheckCircle2 size={14} className={styles.successIcon} />
          <div>
            <p className={styles.successTitle}>Project completed by your lecturer</p>
            <p className={styles.successBody}>
              {guidanceProject.updatedAt
                ? `Completed on ${formatDateTime(guidanceProject.updatedAt)}.`
                : 'Your lecturer has marked this project as completed.'}
              {currentMilestone?.lectureFeedback !== undefined &&
              currentMilestone?.lectureFeedback !== null
                ? ` Final grade: ${currentMilestone.lectureFeedback}/10.`
                : ''}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // CANCELLED
  return (
    <section className={styles.projectCard}>
      <div className={styles.cardHeader}>
        <span className={styles.cardMarker}>02 / GUIDANCE PROJECT</span>
        <h2 className={styles.cardTitle}>{guidanceProject.title}</h2>
      </div>
      <span className={`${styles.statusBadge} ${GUIDANCE_STATUS_PALETTE.CANCELLED}`}>
        CANCELLED
      </span>
      <div className={styles.warnCard}>
        <AlertCircle size={14} className={styles.warnIcon} />
        <div>
          <p className={styles.warnTitle}>Project cancelled</p>
          <p className={styles.warnBody}>
            Either you or your lecturer withdrew from this guidance project.
          </p>
          <p className={styles.warnBody} style={{ fontStyle: 'italic', marginTop: 4 }}>
            Cancellation reason is not yet captured by the platform.
          </p>
        </div>
      </div>
    </section>
  );
}

export default GraduateStudentDashboard;

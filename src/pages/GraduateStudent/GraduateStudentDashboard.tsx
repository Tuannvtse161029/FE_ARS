/**
 * GraduateStudentDashboard — Research Journey
 * ARS Research Constellation — Graduate Student Landing Page
 *
 * Features:
 * - PageHeader + MetricCard grid summarizing the student's group, topic,
 *   lecturer, and milestones at a glance
 * - Two-column layout: current milestone card + recent activity feed
 * - Role-specific slate-blue accent (`--ars-gradstudent`)
 * - Empty/loading/error states use shared utilities
 */
import { useEffect, useMemo, useState } from 'react';
import {
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
import { lecturerLookupService } from '../../services/lecturerLookup.service';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDate';
import type {
  GuidanceProjectStatus,
} from '../../types/research';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button';
import { MetricCard } from '../../components/workspace/MetricCard';
import {
  ActivityFeed,
  type ActivityEntry,
} from '../../components/workspace/ActivityFeed';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import styles from './GraduateStudentDashboard.module.css';

// Default folder key for Firebase uploads.
const DEFAULT_FOLDER_KEY = 'milestone';

// Role accent — Graduate Student workspace uses the shared gold action color.
const ROLE_ACCENT = 'var(--accent-primary)';

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
      tag: <StatusBadge status={report.status} size="sm" />,
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
        <PageHeader
          eyebrow="RESEARCH JOURNEY"
          title="Graduate Student Workspace"
          description="Please sign in to view your workspace."
          accent={ROLE_ACCENT}
        />
      </div>
    );
  }

  if (isLoading && !guidanceProject && joinedGroups.length === 0) {
    return (
      <div className={styles.page}>
        <PageHeader
          eyebrow="RESEARCH JOURNEY"
          title="Graduate Student Workspace"
          description={`Welcome back, ${user.username}. Loading your research journey…`}
          accent={ROLE_ACCENT}
        />
        <div className={styles.loadingGrid}>
          <SkeletonRow count={4} rowHeight={100} gap={16} />
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
      {/* ── Page Header ─────────────────────────────────── */}
      <PageHeader
        eyebrow="RESEARCH JOURNEY"
        title={`${user.username}'s Research Journey`}
        description="Track your guidance project, milestones, and lecturer feedback."
        accent={ROLE_ACCENT}
        actions={
          <Button
            variant="outline"
            size="sm"
            leftIcon={
              isLoading || reportsLoading ? (
                <Loader2 size={13} className={styles.spin} />
              ) : (
                <RefreshCw size={13} />
              )
            }
            onClick={handleRefresh}
            disabled={isLoading || reportsLoading}
            aria-label="Refresh dashboard"
          >
            Refresh
          </Button>
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
          <ErrorBanner
            tone="error"
            message={error.message}
          />
        ) : null}

        {/* ── Current milestone: primary student task ────── */}
        <div className={styles.primaryTask}>
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
        </div>

        {/* ── Research context ──────────────────────────── */}
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

        {/* ── Activity timeline ─────────────────────────── */}
        <div className={styles.twoCol}>
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
        <EmptyState
          icon={<Inbox size={24} />}
          title="No active guidance project"
          description="Once a lecturer invites you, a card will appear here."
          compact
        />
        <div className={styles.actionRow}>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<HelpCircle size={13} />}
            disabled
            aria-label="Request supervision"
            aria-describedby="request-supervision-unavailable"
            title="Request supervision is not yet available — the Grad-initiated POST endpoint is on the BE gap ticket (§D.3)."
          >
            Request supervision
          </Button>
          <p id="request-supervision-unavailable" className={styles.actionHint}>
            Supervision requests will be available after the backend adds the student-initiated request endpoint.
          </p>
        </div>
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
        <div className={styles.actionRow}>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Withdraw is disabled in the PROPOSED state."
          >
            Withdraw
          </Button>
        </div>
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
          <EmptyState
            icon={<Calendar size={24} />}
            title="No active milestone"
            description="Click Submit milestone to upload your first report."
            compact
          />
        )}

        <div className={styles.actionRow}>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<FileText size={13} />}
            onClick={onOpenSubmit}
            disabled={!hasGroup || !hasTopic}
            aria-label="Submit milestone report"
          >
            {currentMilestone ? 'Update submission' : 'Submit milestone'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Withdraw is disabled in this build."
          >
            Withdraw
          </Button>
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
      <ErrorBanner
        tone="warning"
        title="Project cancelled"
        message="Either you or your lecturer withdrew from this guidance project. Cancellation reason is not yet captured by the platform."
      />
    </section>
  );
}

export default GraduateStudentDashboard;
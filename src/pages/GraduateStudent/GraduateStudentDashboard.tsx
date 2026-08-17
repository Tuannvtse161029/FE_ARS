import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
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
import styles from './GraduateStudentDashboard.module.css';

// Landing page for the Graduate Student role. Per `lead-phase-c-contract.md`
// G4 this page renders one of the following state cards based on the student's
// Guidance Project status (or the absence of one):
//
//   - Loading skeleton
//   - No guidance project + "Request supervision" disabled-with-tooltip
//   - PROPOSED
//   - ONGOING (no mark-complete, only Withdraw)
//   - COMPLETED
//   - CANCELLED (no fake cancellation reason; tooltip "Cancellation reason is
//     not yet captured by the platform.")
//
// It also refreshes on focus (G4(i)) and reads `joinedGroups[i].membershipId`
// (G1) when opening the SubmitReportModal.

// Default folder key for Firebase uploads. Per lead-phase-c-contract.md G3
// this is **only** a Firebase-folder label — it has no representation in the
// BE PhasedReports schema. The actual page derives the key from
// `primaryTopic?.title ?? primaryGroup.name ?? 'milestone'` so the folder
// path reflects what the student actually sees.
const DEFAULT_FOLDER_KEY = 'milestone';

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

  // The dashboard's invitation surface is contractually read-only — the BE
  // has no `/api/GroupInvitation` (gap ticket §D.2). We render the banner
  // with `invitation={null}` so the "what would this look like" UX is
  // visible without faking a row.
  const [invitation] = useState<null | {
    id: string;
    lecturerName: string;
    groupName: string;
    topicTitle?: string;
    sentAt?: string;
  }>(null);

  // Modal state for fresh submission of the current milestone.
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resubmitting, setResubmitting] = useState<SubmittedPhasedReport | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedPhasedReport | null>(null);

  // Mirror of the lecturerLookup cache so a successful probe re-renders the
  // hero label locally without making the helper React-aware.
  const [lecturerNames, setLecturerNames] = useState<Record<number, string>>({});

  const lecturerId = guidanceProject?.lecturerId ?? primaryGroup?.lecturerId ?? null;

  // Fire-and-forget probe — ensure display name is resolved when possible.
  useEffect(() => {
    if (typeof lecturerId === 'number' && lecturerId > 0) {
      lecturerLookupService.ensureLecturerDisplayName(lecturerId);
    }
  }, [lecturerId]);

  // Subscribe to lecturer-name resolution events so the hero label updates
  // without a full re-render.
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

  const recentActivity = useMemo(() => {
    const sorted = [...reports].sort((a, b) => {
      const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bTime - aTime;
    });
    return sorted.slice(0, 5);
  }, [reports]);

  const handleRefresh = async (): Promise<void> => {
    await Promise.all([refetch(), refetchReports()]);
  };

  // G4(i) — refresh-on-focus. When the tab becomes visible again after the
  // student switched away, re-fetch both the hook data and the report list.
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

  const handleAcceptInvitation = (): void => {
    // No-op per the documented BE gap — see InvitationBanner.
  };

  const handleDeclineInvitation = (): void => {
    // No-op per the documented BE gap — see InvitationBanner.
  };

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

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.notSignedIn}>
          <AlertCircle size={20} />
          <span>Please sign in to view your dashboard.</span>
        </div>
      </div>
    );
  }

  // G4(a) — Loading state (skeleton cards).
  if (isLoading && !guidanceProject && joinedGroups.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.heroHeader}>
          <div className={styles.heroLeft}>
            <span className={styles.heroIconCircle} aria-hidden>
              <GraduationCap size={26} />
            </span>
            <div>
              <h1 className={styles.heroTitle}>Graduate Student Workspace</h1>
              <p className={styles.heroSubtitle}>
                Welcome back, {user.username}. Loading your dashboard…
              </p>
            </div>
          </div>
          <span className={styles.refreshBtn} aria-hidden>
            <Loader2 size={14} className={styles.spin} />
            <span>Loading</span>
          </span>
        </header>
        <section className={styles.summaryGrid} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`${styles.summaryCard} ${styles.summaryCardEmpty}`}
            >
              <span className={styles.summaryIcon}>
                <Loader2 size={16} className={styles.spin} />
              </span>
              <span className={styles.summaryLabel}>Loading</span>
              <span className={styles.summaryPrimary}>…</span>
              <span className={styles.summarySecondary}>…</span>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.heroHeader}>
        <div className={styles.heroLeft}>
          <span className={styles.heroIconCircle} aria-hidden>
            <GraduationCap size={26} />
          </span>
          <div>
            <h1 className={styles.heroTitle}>Graduate Student Workspace</h1>
            <p className={styles.heroSubtitle}>
              Welcome back, {user.username}. Track your guidance project,
              milestones, and lecturer feedback in one place.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={isLoading || reportsLoading}
          aria-label="Refresh dashboard"
        >
          {isLoading || reportsLoading ? (
            <Loader2 size={14} className={styles.spin} />
          ) : (
            <RefreshCw size={14} />
          )}
          <span>Refresh</span>
        </button>
      </header>

      {invitation ? (
        <InvitationBanner
          invitation={invitation}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
        />
      ) : null}

      {error ? (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>{error.message}</span>
        </div>
      ) : null}

      <section className={styles.summaryGrid}>
        <SummaryCard
          icon={<Microscope size={18} />}
          label="Guidance Project"
          primary={guidanceProject?.title ?? 'No active project'}
          secondary={
            guidanceProject?.status
              ? `Status: ${guidanceProject.status}`
              : 'Awaiting lecturer confirmation'
          }
          empty={!guidanceProject}
        />
        <SummaryCard
          icon={<Users size={18} />}
          label="Supervising Lecturer"
          primary={lecturerName}
          secondary={
            primaryGroup?.name ? `Group: ${primaryGroup.name}` : 'No group joined yet'
          }
          empty={!lecturerId && !primaryGroup}
        />
        <SummaryCard
          icon={<FileText size={18} />}
          label="Assigned Topic"
          primary={primaryTopic?.title ?? 'No topic assigned'}
          secondary={
            primaryTopic?.status
              ? `Status: ${primaryTopic.status}`
              : 'Awaiting lecturer assignment'
          }
          empty={!primaryTopic}
        />
        <SummaryCard
          icon={<Layers size={18} />}
          label="Joined Groups"
          primary={`${joinedGroups.length} active`}
          secondary={
            joinedGroups[0]
              ? `Most recent: ${joinedGroups[0].name}`
              : 'Join a research group to begin'
          }
          empty={joinedGroups.length === 0}
        />
      </section>

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

      <section className={styles.activitySection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Recent Activity</h2>
            <p className={styles.sectionSubtitle}>
              Your last {recentActivity.length || 0} submission
              {recentActivity.length === 1 ? '' : 's'}.
            </p>
          </div>
        </div>
        {reportsLoading ? (
          <div className={styles.emptyCard}>
            <Loader2 size={18} className={styles.spin} />
            <span>Loading recent submissions…</span>
          </div>
        ) : recentActivity.length === 0 ? (
          <div className={styles.emptyCard}>
            <Inbox size={20} />
            <span>No submissions yet.</span>
          </div>
        ) : (
          <ul className={styles.activityList}>
            {recentActivity.map((report) => (
              <li key={report.id} className={styles.activityItem}>
                <span className={styles.activityStatus}>
                  <StatusBadge status={report.status} />
                </span>
                <div className={styles.activityMeta}>
                  <span className={styles.activityTitle}>
                    Report #{report.id}
                  </span>
                  <span className={styles.activityDate}>
                    {report.submittedAt
                      ? formatRelativeTime(report.submittedAt)
                      : 'Unknown date'}
                  </span>
                </div>
                <a
                  href={report.reportFileUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.activityLink}
                >
                  {report.reportFileUrl ? 'Open PDF' : 'No file'}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

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

// ---------- Sub-components ----------

interface SummaryCardProps {
  icon: JSX.Element;
  label: string;
  primary: string;
  secondary: string;
  empty?: boolean;
}

function SummaryCard({
  icon,
  label,
  primary,
  secondary,
  empty,
}: SummaryCardProps): JSX.Element {
  return (
    <div className={`${styles.summaryCard} ${empty ? styles.summaryCardEmpty : ''}`}>
      <span className={styles.summaryIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryPrimary}>{primary}</span>
      <span className={styles.summarySecondary}>{secondary}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: PhasedReportStatus }): JSX.Element {
  const palette: Record<PhasedReportStatus, string> = {
    WAITING: styles.statusWaiting,
    SUBMITTED: styles.statusSubmitted,
    EVALUATED: styles.statusEvaluated,
    REJECTED: styles.statusRejected,
  };
  return <span className={`${styles.statusBadge} ${palette[status]}`}>{status}</span>;
}

interface GuidanceProjectCardProps {
  guidanceProject:
    | import('../../types/research').GuidanceProject
    | null;
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
  isLoading,
  lecturerName,
  hasGroup,
  hasTopic,
  onOpenSubmit,
  currentMilestone,
  onResubmit,
}: GuidanceProjectCardProps): JSX.Element {
  // G4(b) — no guidance project + "Request supervision" disabled-with-tooltip.
  if (!guidanceProject) {
    return (
      <section className={styles.milestoneSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Guidance Project</h2>
            <p className={styles.sectionSubtitle}>
              You haven&apos;t started a guidance project yet.
            </p>
          </div>
        </div>
        <div className={styles.emptyCard}>
          <Inbox size={20} />
          <span>
            You don&apos;t have an active guidance project. Once a lecturer
            invites you, a card will appear here.
          </span>
        </div>
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled
            aria-disabled="true"
            title="Request supervision is not yet available — the Grad-initiated POST endpoint is on the BE gap ticket (§D.3)."
          >
            <HelpCircle size={14} />
            <span>Request supervision</span>
          </button>
        </div>
      </section>
    );
  }

  // G4(c) — PROPOSED.
  if (guidanceProject.status === 'PROPOSED') {
    return (
      <section className={styles.milestoneSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Guidance Project</h2>
            <p className={styles.sectionSubtitle}>
              {guidanceProject.title} · awaiting your lecturer
            </p>
          </div>
          <span
            className={`${styles.statusBadge} ${GUIDANCE_STATUS_PALETTE.PROPOSED}`}
          >
            PROPOSED
          </span>
        </div>
        <div className={styles.infoCard}>
          <span className={styles.infoIcon} aria-hidden>
            <Clock size={18} />
          </span>
          <div>
            <p className={styles.infoTitle}>Awaiting lecturer confirmation</p>
            <p className={styles.infoBody}>
              Your lecturer ({lecturerName}) has proposed this guidance
              project. They will move it to ONGOING once both of you agree on
              the milestones.
            </p>
          </div>
        </div>
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled
            aria-disabled="true"
            title="Withdraw is disabled in the PROPOSED state — only your lecturer can move this project forward."
          >
            Withdraw
          </button>
        </div>
      </section>
    );
  }

  // G4(d) — ONGOING (no mark-complete).
  if (guidanceProject.status === 'ONGOING') {
    return (
      <section className={styles.milestoneSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Current Milestone</h2>
            <p className={styles.sectionSubtitle}>
              {guidanceProject.title} · supervised by {lecturerName}
            </p>
          </div>
          <span
            className={`${styles.statusBadge} ${GUIDANCE_STATUS_PALETTE.ONGOING}`}
          >
            ONGOING
          </span>
        </div>

        {currentMilestone?.status === 'REJECTED' ? (
          <RejectionFeedbackBanner
            report={currentMilestone}
            onResubmit={onResubmit}
          />
        ) : currentMilestone?.status === 'SUBMITTED' ? (
          <div className={styles.infoCard}>
            <span className={styles.infoIcon} aria-hidden>
              <Clock size={18} />
            </span>
            <div>
              <p className={styles.infoTitle}>Awaiting lecturer review</p>
              <p className={styles.infoBody}>
                Your report (#{currentMilestone.id}) was submitted on{' '}
                {currentMilestone.submittedAt
                  ? formatDateTime(currentMilestone.submittedAt)
                  : 'an unknown date'}
                . You will be notified once the lecturer provides feedback.
              </p>
            </div>
          </div>
        ) : currentMilestone?.status === 'EVALUATED' ? (
          <div className={styles.successCard}>
            <span className={styles.successIcon} aria-hidden>
              <CheckCircle2 size={18} />
            </span>
            <div>
              <p className={styles.successTitle}>Milestone approved</p>
              <p className={styles.successBody}>
                Report #{currentMilestone.id} was approved
                {typeof currentMilestone.lectureFeedback === 'number'
                  ? ` with a grade of ${currentMilestone.lectureFeedback}/10`
                  : ''}
                . Submit your next milestone when ready.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.emptyCard}>
            <Calendar size={20} />
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
            <FileText size={14} />
            <span>{currentMilestone ? 'Update submission' : 'Submit milestone'}</span>
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled
            aria-disabled="true"
            title="Withdraw is disabled in the demo build — the BE PUT /api/GuidanceProject/{id} path is wired in v2."
          >
            Withdraw
          </button>
        </div>
      </section>
    );
  }

  // G4(e) — COMPLETED.
  if (guidanceProject.status === 'COMPLETED') {
    return (
      <section className={styles.milestoneSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Guidance Project</h2>
            <p className={styles.sectionSubtitle}>
              {guidanceProject.title} · completed
            </p>
          </div>
          <span
            className={`${styles.statusBadge} ${GUIDANCE_STATUS_PALETTE.COMPLETED}`}
          >
            COMPLETED
          </span>
        </div>
        <div className={styles.successCard}>
          <span className={styles.successIcon} aria-hidden>
            <CheckCircle2 size={18} />
          </span>
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
        {!isLoading && currentMilestone ? (
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled
              aria-disabled="true"
              title="Once a project is COMPLETED no further submissions are accepted."
            >
              Submit milestone
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  // G4(f) — CANCELLED.
  return (
    <section className={styles.milestoneSection}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Guidance Project</h2>
          <p className={styles.sectionSubtitle}>
            {guidanceProject.title} · cancelled
          </p>
        </div>
        <span
          className={`${styles.statusBadge} ${GUIDANCE_STATUS_PALETTE.CANCELLED}`}
        >
          CANCELLED
        </span>
      </div>
      <div className={styles.warnCard}>
        <span className={styles.warnIcon} aria-hidden>
          <AlertCircle size={18} />
        </span>
        <div>
          <p className={styles.warnTitle}>Project cancelled</p>
          <p className={styles.warnBody}>
            Either you or your lecturer withdrew from this guidance project.
          </p>
          <p
            className={styles.warnBody}
            title="Cancellation reason is not yet captured by the platform."
          >
            <em>Cancellation reason is not yet captured by the platform.</em>
          </p>
        </div>
      </div>
    </section>
  );
}

export default GraduateStudentDashboard;

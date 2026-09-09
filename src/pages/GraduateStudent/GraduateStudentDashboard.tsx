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
import { useI18n, useLocale } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useStudentGroups } from '../../hooks/useStudentGroups';
import { usePhasedReports } from '../../hooks/usePhasedReports';
import InvitationBanner from '../../components/gradstudent/InvitationBanner';
import RejectionFeedbackBanner from '../../components/gradstudent/RejectionFeedbackBanner';
import SubmitReportModal from '../../components/gradstudent/SubmitReportModal';
import { getPrimaryMembershipId } from '../../components/gradstudent/utils';
import { lecturerLookupService } from '../../services/lecturerLookup.service';
import { formatDateTime, formatRelativeTime } from '../../utils/formatDate';
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

export const GraduateStudentDashboard = (): JSX.Element => {
  const { t } = useI18n();
  const locale = useLocale();
  const copy = (en: string, vi: string): string => (locale === 'en' ? en : vi);
  const { user } = useAuth();
  const studentId = user?.userId ?? null;

  const {
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

  // Lecturer is resolved from the primary group's lecturerId
  const lecturerId = primaryGroup?.lecturerId ?? null;

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

  if (isLoading && joinedGroups.length === 0) {
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
      label: copy('Research Group', 'Nhóm nghiên cứu'),
      value: primaryGroup?.name ?? copy('No group joined', 'Chưa tham gia nhóm'),
      annotation: primaryGroup?.description
        ? primaryGroup.description
        : copy('Join a research group to begin', 'Hãy tham gia nhóm nghiên cứu để bắt đầu'),
      icon: <Microscope size={16} />,
      empty: !primaryGroup,
    },
    {
      label: copy('Supervising Lecturer', 'Giảng viên hướng dẫn'),
      value: lecturerName,
      annotation: primaryGroup?.name
        ? `${copy('Group', 'Nhóm')}: ${primaryGroup.name}`
        : copy('No group joined yet', 'Chưa tham gia nhóm nào'),
      icon: <Users size={16} />,
      empty: !primaryGroup,
    },
    {
      label: copy('Assigned Topic', 'Đề tài được phân công'),
      value: primaryTopic?.title ?? copy('No topic assigned', 'Chưa có đề tài'),
      annotation: primaryTopic?.status
        ? `${copy('Status', 'Trạng thái')}: ${primaryTopic.status}`
        : copy('Awaiting lecturer assignment', 'Đang chờ giảng viên giao đề tài'),
      icon: <FileText size={16} />,
      empty: !primaryTopic,
    },
    {
      label: copy('Joined Groups', 'Nhóm đã tham gia'),
      value: `${joinedGroups.length} ${copy('active', 'hoạt động')}`,
      annotation: joinedGroups[0]
        ? `${copy('Most recent', 'Gần nhất')}: ${joinedGroups[0].name}`
        : copy('Join a research group to begin', 'Hãy tham gia nhóm nghiên cứu để bắt đầu'),
      icon: <Layers size={16} />,
      empty: joinedGroups.length === 0,
    },
  ];

  return (
    <div className={styles.page}>
      {/* ── Page Header ─────────────────────────────────── */}
      <PageHeader
        eyebrow={t('student.dashboard.eyebrow', 'RESEARCH JOURNEY')}
        title={`${user.username}'s ${t('student.dashboard.journey', 'Research Journey')}`}
        description={t('student.dashboard.description', 'Track your research group, milestones, and lecturer feedback.')}
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
            {t('common.refresh', 'Refresh')}
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
          <ResearchGroupCard
            isLoading={reportsLoading}
            groupName={primaryGroup?.name ?? undefined}
            topicTitle={primaryTopic?.title ?? undefined}
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
              marker={copy('02 / SUBMISSION LOG', '02 / LỊCH SỬ NỘP BÁO CÁO')}
              title={copy('Recent Milestones', 'Các mốc gần đây')}
              entries={recentActivity}
              loading={reportsLoading && reports.length === 0}
              emptyMessage={copy('No submissions recorded yet.', 'Chưa có lượt nộp báo cáo nào.')}
            />

            {/* Current status callout - show when there's a pending submission */}
            {currentMilestone && (
              <div className={styles.statusCallout}>
                <div className={styles.calloutHeader}>
                  <span className={styles.calloutMarker}>{copy('CURRENT STATUS', 'TRẠNG THÁI HIỆN TẠI')}</span>
                </div>
                <div className={styles.calloutBody}>
                  {currentMilestone.status === 'REJECTED' ? (
                    <p className={styles.calloutText}>
                      {copy('Your latest submission was returned for revision. Review the feedback and resubmit when ready.', 'Báo cáo gần nhất của bạn cần chỉnh sửa. Vui lòng xem nhận xét và nộp lại.')}
                    </p>
                  ) : currentMilestone.status === 'SUBMITTED' ? (
                    <p className={styles.calloutText}>
                      {`${copy('Submitted on', 'Đã nộp vào')} ${
                        currentMilestone.submittedAt
                          ? formatDateTime(currentMilestone.submittedAt)
                          : copy('an unknown date', 'thời gian chưa xác định')
                      }. ${copy('Awaiting lecturer feedback.', 'Đang chờ nhận xét từ giảng viên.')}`}
                    </p>
                  ) : currentMilestone.status === 'EVALUATED' ? (
                    <p className={styles.calloutText}>
                      {`${copy('Milestone approved', 'Mốc tiến độ đã được duyệt')}${
                        typeof currentMilestone.lectureFeedback === 'number'
                          ? ` ${copy('with a grade of', 'với số điểm')} ${currentMilestone.lectureFeedback}/10`
                          : ''
                      }. ${copy('Submit your next milestone when ready.', 'Hãy nộp mốc tiếp theo khi hoàn thành.')}`}
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

interface ResearchGroupCardProps {
  isLoading: boolean;
  groupName?: string;
  topicTitle?: string;
  lecturerName: string;
  hasGroup: boolean;
  hasTopic: boolean;
  onOpenSubmit: () => void;
  currentMilestone: SubmittedPhasedReport | null;
  onResubmit: (report: SubmittedPhasedReport) => void;
}

function ResearchGroupCard({
  isLoading: _isLoading,
  groupName,
  topicTitle: _topicTitle,
  lecturerName,
  hasGroup,
  hasTopic,
  onOpenSubmit,
  currentMilestone,
  onResubmit,
}: ResearchGroupCardProps): JSX.Element {
  const locale = useLocale();
  const copy = (en: string, vi: string): string => (locale === 'en' ? en : vi);

  if (!groupName) {
    return (
      <section className={styles.projectCard}>
        <div className={styles.cardHeader}>
          <span className={styles.cardMarker}>{copy('02 / RESEARCH GROUP', '02 / NHÓM NGHIÊN CỨU')}</span>
          <h2 className={styles.cardTitle}>{copy('Current Group', 'Nhóm hiện tại')}</h2>
        </div>
        <EmptyState
          icon={<Inbox size={24} />}
          title={copy('No active research group', 'Chưa tham gia nhóm nghiên cứu nào')}
          description={copy('Once you join a research group, a card will appear here.', 'Khi bạn tham gia một nhóm nghiên cứu, thông tin sẽ xuất hiện tại đây.')}
          compact
        />
        <div className={styles.actionRow}>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<HelpCircle size={13} />}
            disabled
            aria-label="Request group"
            aria-describedby="request-group-unavailable"
            title={copy('Request group is not yet available.', 'Tính năng yêu cầu tham gia nhóm đang được cập nhật.')}
          >
            {copy('Find a group', 'Tìm nhóm')}
          </Button>
          <p id="request-group-unavailable" className={styles.actionHint}>
            {copy('Group discovery will be available in a future update.', 'Tính năng tìm nhóm sẽ khả dụng trong bản cập nhật tới.')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.projectCard}>
      <div className={styles.cardHeader}>
        <span className={styles.cardMarker}>{copy('02 / CURRENT MILESTONE', '02 / MỐC TIẾN ĐỘ HIỆN TẠI')}</span>
        <h2 className={styles.cardTitle}>{groupName}</h2>
        <p className={styles.cardSubtitle}>{`${copy('Supervised by', 'Giảng viên hướng dẫn')}: ${lecturerName}`}</p>
      </div>

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
            <p className={styles.infoTitle}>{copy('Awaiting lecturer review', 'Đang chờ giảng viên xem xét')}</p>
            <p className={styles.infoBody}>
              {`${copy('Submitted on', 'Đã nộp vào')} ${
                currentMilestone.submittedAt
                  ? formatDateTime(currentMilestone.submittedAt)
                  : copy('an unknown date', 'thời gian chưa xác định')
              }. ${copy('You will be notified once feedback is available.', 'Bạn sẽ nhận được thông báo khi có nhận xét.')}`}
            </p>
          </div>
        </div>
      ) : currentMilestone?.status === 'EVALUATED' ? (
        <div className={styles.successCard}>
          <CheckCircle2 size={14} className={styles.successIcon} />
          <div>
            <p className={styles.successTitle}>{copy('Milestone approved', 'Mốc tiến độ đã được phê duyệt')}</p>
            <p className={styles.successBody}>
              {`${copy('Report', 'Báo cáo')} #${currentMilestone.id} ${copy('was approved', 'đã được phê duyệt')}${
                typeof currentMilestone.lectureFeedback === 'number'
                  ? ` ${copy('with a grade of', 'với số điểm')} ${currentMilestone.lectureFeedback}/10`
                  : ''
              }.`}
            </p>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Calendar size={24} />}
          title={copy('No active milestone', 'Chưa có mốc tiến độ nào')}
          description={copy('Click Submit milestone to upload your first report.', 'Nhấn Nộp mốc tiến độ để tải lên báo cáo đầu tiên.')}
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
          {currentMilestone ? copy('Update submission', 'Cập nhật bài nộp') : copy('Submit milestone', 'Nộp mốc tiến độ')}
        </Button>
      </div>
    </section>
  );
}

export default GraduateStudentDashboard;

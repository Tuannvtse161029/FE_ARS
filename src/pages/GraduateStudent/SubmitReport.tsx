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
          <span>Vui lòng đăng nhập để xem và nộp báo cáo nghiên cứu.</span>
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

  const getStatusBadgeStyle = (status?: string | null) => {
    switch (status) {
      case 'Passed':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'Đạt (Passed)' };
      case 'OnTime':
        return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe', label: 'Đúng hạn (On Time)' };
      case 'Overdue':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca', label: 'Quá hạn (Overdue)' };
      case 'Rejected':
        return { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', label: 'Cần sửa đổi (Rejected)' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', label: 'Chưa nộp (Pending)' };
    }
  };

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumbs}>
        Home &gt; Collaborative Workspace &gt;{' '}
        {primaryGroup?.name ?? 'Research Group'} &gt;{' '}
        <span className={styles.activeBreadcrumb}>Nộp Báo Cáo Tiến Độ (5 Phases)</span>
      </nav>

      <header className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Nộp Báo Cáo Nghiên Cứu Theo Giai Đoạn (5 Phases)</h1>
          <p className={styles.pageSubtitle}>
            Theo dõi 5 cột mốc tiến độ của đề tài và nộp báo cáo định kỳ. Giảng viên hướng dẫn sẽ đánh giá và phản hồi trực tiếp.
          </p>
        </div>
      </header>

      {error ? (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>{error.message}</span>
        </div>
      ) : null}

      {/* Leader status alert */}
      {primaryGroup && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.875rem 1.25rem',
            borderRadius: '8px',
            backgroundColor: isCurrentUserLeader ? '#fefce8' : '#f8fafc',
            border: `1px solid ${isCurrentUserLeader ? '#fef08a' : '#e2e8f0'}`,
            color: isCurrentUserLeader ? '#854d0e' : '#334155',
            fontSize: '0.9rem',
          }}
        >
          <Crown size={18} color={isCurrentUserLeader ? '#ca8a04' : '#64748b'} />
          <div>
            {isCurrentUserLeader ? (
              <span>
                <strong>Bạn là Trưởng nhóm (Leader):</strong> Bạn có quyền đại diện nhóm nộp các bài báo cáo tiến độ (Phase 1-5).
              </span>
            ) : leaderMember ? (
              <span>
                Trưởng nhóm phụ trách nộp bài: <strong>{leaderMember.studentName || `Sinh viên #${leaderMember.studentId}`}</strong> ({leaderMember.studentEmail || 'Chưa cập nhật email'}).
              </span>
            ) : (
              <span>
                Nhóm chưa có Trưởng nhóm. Vui lòng liên hệ Giảng viên hướng dẫn để gán vai trò Trưởng nhóm (Leader) trước khi nộp bài.
              </span>
            )}
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {/* Topic & Group Info */}
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Thông Tin Đề Tài & Nhóm</h3>

          {isLoading ? (
            <div className={styles.detailRow}>
              <Loader2 size={14} className={styles.spin} />
              <span>Đang tải thông tin nhóm…</span>
            </div>
          ) : !primaryGroup ? (
            <div className={styles.emptyState}>
              <Inbox size={18} />
              <span>
                Bạn chưa tham gia nhóm nghiên cứu nào. Khi được Giảng viên phân công vào nhóm, bạn sẽ có thể nộp báo cáo tại đây.
              </span>
            </div>
          ) : (
            <>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Giảng viên HD</span>
                <span className={styles.detailVal}>
                  <Users size={12} />
                  {typeof lecturerId === 'number'
                    ? `Lecturer #${lecturerId}`
                    : 'Chưa phân công'}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Đề tài (Topic)</span>
                <span className={styles.detailVal}>
                  <FileText size={12} />
                  {primaryTopic?.title ?? `Topic #${topicId ?? '—'}`}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Nhóm nghiên cứu</span>
                <span className={styles.detailVal}>
                  <Users size={12} />
                  {primaryGroup.name}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Hạn chót toàn dự án</span>
                <span className={styles.detailVal}>
                  <Calendar size={12} />
                  {primaryGroup.deadline
                    ? formatDate(primaryGroup.deadline)
                    : 'Chưa đặt hạn chót'}
                </span>
              </div>
            </>
          )}
        </section>

        {/* 5 Phases List */}
        <section className={styles.card} style={{ gridColumn: 'span 2' }}>
          <h3 className={styles.cardTitle}>Danh Sách 5 Giai Đoạn Báo Cáo (Phase Milestones)</h3>

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
              <span>Đang tải danh sách cột mốc Phase…</span>
            </div>
          ) : topicPhases.length === 0 ? (
            <div className={styles.emptyState}>
              <Clock size={18} />
              <span>
                Giảng viên chưa thiết lập 5 cột mốc Phase cho Đề tài này. Vui lòng nhắc Giảng viên cấu hình tại trang Thiết lập cột mốc.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              {topicPhases.map((phase) => {
                const pNum = phase.phaseNumber ?? 1;
                const statusStyle = getStatusBadgeStyle(phase.status);
                const isPassed = phase.status === 'Passed';
                const hasFile = Boolean(phase.reportFileUrl);

                return (
                  <div
                    key={`phase-${phase.phasedReportId || pNum}`}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      backgroundColor: isPassed ? '#f0fdf4' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            backgroundColor: isPassed ? '#15803d' : '#0f172a',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                          }}
                        >
                          {pNum}
                        </span>
                        <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                          {phase.milestoneTitle || `Phase ${pNum}`}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.text,
                            border: `1px solid ${statusStyle.border}`,
                          }}
                        >
                          {statusStyle.label}
                        </span>
                        {phase.lectureFeedback != null && (
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#15803d' }}>
                            Điểm: {phase.lectureFeedback}/10
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', fontSize: '0.85rem', color: '#475569' }}>
                      <div>
                        <strong>Hạn nộp:</strong> {formatDate(phase.deadlineAt)}
                      </div>
                      {phase.submittedAt && (
                        <div>
                          <strong>Đã nộp lúc:</strong> {formatDate(phase.submittedAt)}
                        </div>
                      )}
                    </div>

                    {/* Submitted File Link */}
                    {hasFile && (
                      <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={14} color="#0284c7" />
                        <span>File báo cáo đã nộp:</span>
                        <a
                          href={phase.reportFileUrl!}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#0284c7', textDecoration: 'underline', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        >
                          Xem file PDF <ExternalLink size={12} />
                        </a>
                      </div>
                    )}

                    {/* Lecturer Feedback */}
                    {phase.lecturerDescription && (
                      <div style={{ backgroundColor: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.825rem', color: '#334155' }}>
                        <strong>Nhận xét của Giảng viên:</strong> {phase.lecturerDescription}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                      {isPassed ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#15803d', fontSize: '0.85rem', fontWeight: 600 }}>
                          <CheckCircle2 size={16} /> Giai đoạn này đã hoàn thành
                        </span>
                      ) : (
                        <button
                          type="button"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            backgroundColor: isCurrentUserLeader ? '#0f172a' : '#e2e8f0',
                            color: isCurrentUserLeader ? '#ffffff' : '#94a3b8',
                            border: 'none',
                            cursor: isCurrentUserLeader ? 'pointer' : 'not-allowed',
                          }}
                          onClick={() => handleOpenPhaseSubmit(pNum, phase.phasedReportId, phase.milestoneTitle || undefined)}
                          disabled={!isCurrentUserLeader}
                          title={isCurrentUserLeader ? 'Nhấn để nộp bài báo cáo cho giai đoạn này' : 'Chỉ Trưởng nhóm (Leader) mới có quyền nộp bài'}
                        >
                          <Upload size={14} />
                          {hasFile ? 'Nộp lại bài báo cáo (Resubmit)' : 'Nộp bài báo cáo (Submit)'}
                        </button>
                      )}
                    </div>
                  </div>
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
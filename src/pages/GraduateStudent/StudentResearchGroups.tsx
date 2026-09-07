/**
 * StudentResearchGroups — Research Journey
 * ARS Research Constellation — Graduate Student workspace
 *
 * Two surfaces:
 *  - Overview: list of joined groups with an invitation banner
 *  - Workspace (per group): milestone progress, learning materials, group
 *    members, and the milestone-reports table
 *
 * Design rules applied:
 *  - PageHeader + role accent `--ars-gradstudent`
 *  - Shared `EmptyState`, `ErrorBanner`, `SkeletonRow`, `StatusBadge`
 *  - Tables use `TableToolbar` + `TablePagination`
 *  - No inline styles in JSX (CSS Modules only)
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CircleCheck,
  CircleX,
  Clock3,
  Compass,
  Crown,
  FileText,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import { useStudentGroups } from '../../hooks/useStudentGroups';
import { usePhasedReports } from '../../hooks/usePhasedReports';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import { groupMemberService, type GroupMember } from '../../services/groupMember.service';
import { getAllGroupMembers } from '../../services/groupMembership.service';
import { researchGroupService, type ResearchGroup } from '../../services/researchGroup.service';
import { notificationService } from '../../services/notification.service';
import { lecturerLookupService } from '../../services/lecturerLookup.service';
import InvitationBanner from '../../components/gradstudent/InvitationBanner';
import RejectionFeedbackBanner from '../../components/gradstudent/RejectionFeedbackBanner';
import SubmitReportModal from '../../components/gradstudent/SubmitReportModal';
import PhaseReportDetailModal from '../../components/gradstudent/PhaseReportDetailModal';
import MilestoneProgress from '../../components/research/MilestoneProgress';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { SortableHeader } from '../../components/table/SortableHeader';
import BackendGapBanner from '../../components/BackendGapBanner';
import { usePagination } from '../../hooks/usePagination';
import { useTableSort } from '../../hooks/useTableSort';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import { useListShortcuts } from '../../hooks/useListShortcuts';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';
import type { LearningMaterial } from '../../services/learningMaterial.service';
import styles from './StudentResearchGroups.module.css';

const DEFAULT_FOLDER_KEY = 'milestone';
const ROLE_ACCENT = 'var(--accent-primary)';

type StatusFilter = 'all' | 'WAITING' | 'SUBMITTED' | 'EVALUATED' | 'REJECTED';
/** Sortable column ids for the Milestone Reports table inside a Group workspace. */
type ReportsSortColumn =
  | 'phase'
  | 'milestone'
  | 'submitted'
  | 'deadline'
  | 'score'
  | 'status';
export const StudentResearchGroups = (): JSX.Element => {
  const { t } = useI18n();
  const { user } = useAuth();
  const locale = useLocale();
  const copy = (english: string, vietnamese: string): string =>
    locale === 'en' ? english : vietnamese;
  const studentId = user?.userId ?? null;

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'my-groups' | 'explore'>('my-groups');
  const [allGroups, setAllGroups] = useState<ResearchGroup[]>([]);
  const [loadingAllGroups, setLoadingAllGroups] = useState<boolean>(false);
  const [exploreSearch, setExploreSearch] = useState<string>('');
  const [applyingGroupId, setApplyingGroupId] = useState<number | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resubmitting, setResubmitting] = useState<SubmittedPhasedReport | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedPhasedReport | null>(null);
  const [lecturerNames, setLecturerNames] = useState<Record<number, string>>({});

  const { joinedGroups, guidanceProject, isLoading, error, refetch } =
    useStudentGroups(studentId);
  const {
    reports,
    isLoading: reportsLoading,
    refetch: refetchReports,
  } = usePhasedReports(selectedGroupId);

  const selectedGroup = useMemo(() => {
    if (selectedGroupId === null) return null;
    return joinedGroups.find((g) => g.id === selectedGroupId) ?? null;
  }, [joinedGroups, selectedGroupId]);

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

  // Sync selected group from URL search params (?groupId=1)
  useEffect(() => {
    const gidParam = searchParams.get('groupId');
    if (gidParam) {
      const gidNum = Number(gidParam);
      if (gidNum > 0) {
        setSelectedGroupId(gidNum);
      }
    }
  }, [searchParams]);

  // Load all research groups for the Explore & Join surface.
  // Strategy:
  //   1. Try GET /api/ResearchGroup (works if BE allows student read)
  //   2. If that fails (403/401), fall back to:
  //      a. GET /api/GroupMember → collect unique researchGroupIds
  //      b. GET /api/ResearchGroup/{id} for each unique id
  const loadAllGroups = async () => {
    setLoadingAllGroups(true);
    try {
      let list: ResearchGroup[] = [];
      try {
        list = await researchGroupService.getAll();
        console.log('[ResearchGroups] getAll returned', list.length, 'groups');
      } catch (primaryErr) {
        console.warn('[ResearchGroups] getAll failed, trying fallback via GroupMember:', primaryErr);
        // Fallback: get all members to discover group IDs, then fetch each group
        const allMembers = await getAllGroupMembers().catch(() => []);
        const uniqueGroupIds = [...new Set(
          allMembers.map((m: { researchGroupId?: number }) => m.researchGroupId).filter(Boolean)
        )] as number[];
        console.log('[ResearchGroups] Fallback: unique group IDs from members:', uniqueGroupIds);
        const results = await Promise.allSettled(
          uniqueGroupIds.map((gid) => researchGroupService.getById(gid))
        );
        list = results
          .filter((r): r is PromiseFulfilledResult<ResearchGroup> => r.status === 'fulfilled')
          .map((r) => r.value);
        console.log('[ResearchGroups] Fallback resolved:', list.length, 'groups');
      }
      setAllGroups(list);
    } catch (err) {
      console.error('[ResearchGroups] loadAllGroups completely failed:', err);
    } finally {
      setLoadingAllGroups(false);
    }
  };

  useEffect(() => {
    void loadAllGroups();
  }, []);

  const handleApplyGroup = async (group: ResearchGroup) => {
    if (!studentId || !user) return;
    const memberCount = group.memberCount ?? (group.members?.length ?? 0);
    if (memberCount >= 5) {
      alert(copy(
        `This research group already has ${memberCount} members and cannot accept another application.`,
        `Nhóm nghiên cứu này đã đủ ${memberCount} thành viên, không thể xin tham gia.`,
      ));
      return;
    }
    const groupId = group.id ?? group.researchGroupId;
    if (!groupId) return;
    setApplyingGroupId(groupId);
    setApplyFeedback(null);
    try {
      await groupMemberService.create({
        researchGroupId: groupId,
        studentId,
        activityStatus: 'Pending',
        joinedAt: new Date().toISOString(),
      });

      // Optimistically save pending application in localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const key = `student_pending_groups_${studentId}`;
          const raw = window.localStorage.getItem(key);
          const currentList: number[] = raw ? JSON.parse(raw) : [];
          if (!currentList.includes(groupId)) {
            currentList.push(groupId);
            window.localStorage.setItem(key, JSON.stringify(currentList));
          }
        } catch {}
      }

      // Notify the lecturer
      if (group.lecturerId) {
        try {
          await notificationService.create({
            userId: group.lecturerId,
            message: `[Group] membership: Sinh viên ${user.username} đã nộp đơn xin gia nhập nhóm "${group.name}".`,
          });
        } catch {
          // ignore notification error
        }
      }

      setApplyFeedback({
        type: 'success',
        message: `Đã nộp đơn xin gia nhập nhóm "${group.name}" thành công! Nhóm đã xuất hiện trong danh sách "Nhóm nghiên cứu của tôi" với trạng thái Chờ duyệt.`,
      });
      await refetch();
      await loadAllGroups();
    } catch (err) {
      setApplyFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : copy(
          'We could not submit your application to join this research group.',
          'Không thể gửi đơn xin gia nhập nhóm.',
        ),
      });
    } finally {
      setApplyingGroupId(null);
    }
  };

  const uniqueLecturerIds = useMemo(() => {
    const ids = new Set<number>();
    joinedGroups.forEach((g) => {
      if (typeof g.lecturerId === 'number' && g.lecturerId > 0) {
        ids.add(g.lecturerId);
      }
    });
    if (selectedGroup && typeof selectedGroup.lecturerId === 'number') {
      ids.add(selectedGroup.lecturerId);
    }
    if (guidanceProject && typeof guidanceProject.lecturerId === 'number') {
      ids.add(guidanceProject.lecturerId);
    }
    return Array.from(ids);
  }, [joinedGroups, selectedGroup, guidanceProject]);

  useEffect(() => {
    uniqueLecturerIds.forEach((id) => {
      lecturerLookupService.ensureLecturerDisplayName(id);
    });
  }, [uniqueLecturerIds]);

  const lecturerNameFor = (lecturerId: number | null | undefined): string => {
    if (typeof lecturerId !== 'number' || lecturerId <= 0) {
      return 'Lecturer';
    }
    const cached = lecturerNames[lecturerId];
    if (cached) return cached;
    return lecturerLookupService.getLecturerDisplayName(lecturerId);
  };

  const filteredReports = reports;

  const handleRefresh = async (): Promise<void> => {
    await refetch();
    await refetchReports();
  };

  const handleSelectGroup = (groupId: number): void => {
    setSelectedGroupId(groupId);
    setSubmitting(false);
    setResubmitting(null);
    setLastSubmitted(null);
  };

  const handleOpenSubmit = (report?: SubmittedPhasedReport): void => {
    if (!selectedGroup) return;
    setResubmitting(report ?? null);
    setSubmitting(true);
  };

  const handleSubmitted = async (report: SubmittedPhasedReport): Promise<void> => {
    setLastSubmitted(report);
    await refetchReports();
  };

  const handleCloseSubmit = (): void => {
    setSubmitting(false);
    setResubmitting(null);
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <ErrorBanner
          tone="error"
          message="Please sign in to view your research groups."
        />
      </div>
    );
  }

  if (selectedGroup) {
    const lecturerId = selectedGroup.lecturerId;
    return (
      <WorkspaceView
        group={selectedGroup}
        lecturerName={lecturerNameFor(lecturerId)}
        reports={filteredReports}
        reportsLoading={reportsLoading}
        searchText={searchText}
        onSearchChange={setSearchText}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onBack={() => setSelectedGroupId(null)}
        onOpenSubmit={handleOpenSubmit}
        isSubmitting={submitting}
        submittingReport={submitting}
        resubmittingReport={resubmitting}
        lastSubmitted={lastSubmitted}
        onCloseSubmit={handleCloseSubmit}
        onSubmitted={handleSubmitted}
        onRefresh={handleRefresh}
        studentId={studentId}
        phaseKey={
          selectedGroup.name
            ? selectedGroup.name.toLowerCase().replace(/\s+/g, '-')
            : DEFAULT_FOLDER_KEY
        }
        phaseTitle={selectedGroup.name}
      />
    );
  }

  // ----- Overview view -----
  const joinedGroupIds = new Set(joinedGroups.map((g) => g.id));

  const filteredAllGroups = allGroups.filter((g) => {
    const name = (g.name ?? '').toLowerCase();
    const description = (g.description ?? '').toLowerCase();
    const lecName = (g.lecturerName ?? '').toLowerCase();
    const q = exploreSearch.toLowerCase();
    return !q || name.includes(q) || description.includes(q) || lecName.includes(q);
  });

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={copy('RESEARCH GROUPS', 'NHÓM NGHIÊN CỨU')}
        title={copy('My Research Groups', 'Nhóm nghiên cứu của tôi')}
        description={
          guidanceProject
            ? `${copy('Active guidance project', 'Dự án hướng dẫn đang thực hiện')}: ${guidanceProject.title}`
            : copy('You have not yet started a guidance project.', 'Bạn chưa tham gia dự án hướng dẫn nào.')
        }
        accent={ROLE_ACCENT}
        actions={
          <Button
            variant="outline"
            size="sm"
            leftIcon={
              isLoading ? (
                <Loader2 size={13} className={styles.spin} />
              ) : (
                <RefreshCw size={13} />
              )
            }
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {copy('Refresh', 'Làm mới')}
          </Button>
        }
      />

      <InvitationBanner
        invitation={null}
        onAccept={() => undefined}
        onDecline={() => undefined}
      />

      {error ? (
        <ErrorBanner tone="error" message={error.message} />
      ) : null}

      {/* Group tabs */}
      <div className={styles.tabContainer}>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'my-groups' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('my-groups')}
        >
          <Users size={16} aria-hidden />
          {t('student.researchGroups.myGroups', 'Nhóm nghiên cứu của tôi')}
          <span className={styles.tabBadge}>{joinedGroups.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'explore' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('explore')}
        >
          <Compass size={16} aria-hidden />
          {t('student.researchGroups.explore', 'Khám phá nhóm nghiên cứu')}
          <span className={styles.tabBadge}>{allGroups.length}</span>
        </button>
      </div>

      {activeTab === 'my-groups' && (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {t('student.researchGroups.myGroups', 'Nhóm nghiên cứu của tôi')}
            </h2>
            <p className={styles.sectionSubtitle}>
              {copy(
                'Groups you have joined or are waiting to join.',
                'Các nhóm bạn đã tham gia hoặc đang chờ duyệt.',
              )}
            </p>
          </div>

          {isLoading ? (
            <SkeletonRow count={3} rowHeight={88} gap={12} />
          ) : joinedGroups.length === 0 ? (
            <EmptyState
              icon={<Inbox size={24} />}
              title={copy('No research groups yet', 'Chưa có nhóm nghiên cứu')}
              description={copy(
                'Explore available groups to find one that suits your research interests.',
                'Chuyển sang tab "Khám phá & Tham gia nhóm" để tìm nhóm phù hợp với bạn.',
              )}
            />
          ) : (
            <ul className={styles.groupList}>
              {joinedGroups.map((g) => {
                const isPending = g.activityStatus === 'Pending' || g.activityStatus === 'PENDING';
                return (
                  <li key={g.id} className={styles.groupCard}>
                    <div className={styles.groupCardLeft}>
                      <span className={styles.groupIconCircle} aria-hidden>
                        <Users size={22} />
                      </span>
                      <div className={styles.groupInfo}>
                        <div className={styles.groupTitleRow}>
                          <h3 className={styles.groupName}>{g.name}</h3>
                          {isPending ? (
                            <span className={styles.pendingBadge}>
                              <Clock3 size={13} aria-hidden />
                              {t('student.researchGroups.pending', 'Chờ duyệt')}
                            </span>
                          ) : (
                            <span className={styles.activityPill}>
                              {g.activityStatus ?? 'ACTIVE'}
                            </span>
                          )}
                          {g.isLeader ? (
                            <span className={styles.leaderBadge}>
                              <Crown size={13} aria-hidden />
                              {t('student.researchGroups.leader', 'Trưởng nhóm')}
                            </span>
                          ) : null}
                        </div>
                        <div className={styles.groupMetaRow}>
                          <span>
                            <Mail size={12} />
                            {copy('Supervised by', 'Giảng viên hướng dẫn')}{' '}
                            {lecturerNameFor(g.lecturerId)}
                          </span>
                          <span>
                            <Calendar size={12} />
                            {g.joinedAt
                              ? `${copy('Joined', 'Đã tham gia')} ${new Date(g.joinedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium' })}`
                              : copy('Recently joined', 'Mới tham gia')}
                          </span>
                        </div>
                        {isPending ? (
                          <p className={styles.pendingExplanation}>
                            {copy(
                              'Your application is awaiting lecturer review and approval.',
                              'Đơn xin gia nhập của bạn đang chờ Giảng viên xem xét và phê duyệt.',
                            )}
                          </p>
                        ) : null}
                        {g.description ? (
                          <p className={styles.groupDescription}>{g.description}</p>
                        ) : null}
                      </div>
                    </div>
                    {isPending ? (
                      <Button variant="outline" size="sm" disabled leftIcon={<Clock3 size={13} />}>
                        {t('student.researchGroups.pending', 'Đang chờ duyệt')}
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => handleSelectGroup(g.id)}>
                        {t('student.researchGroups.openWorkspace', 'Mở không gian nhóm')}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'explore' && (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {t('student.researchGroups.explore', 'Khám phá nhóm nghiên cứu')}
            </h2>
            <p className={styles.sectionSubtitle}>
              {copy(
                'Find research groups that are accepting new members and submit an application.',
                'Tìm kiếm và nộp đơn xin gia nhập các nhóm nghiên cứu đang tuyển thành viên.',
              )}
            </p>
          </div>

          {applyFeedback ? (
            <div
              className={applyFeedback.type === 'success' ? styles.applySuccessBanner : styles.applyErrorBanner}
              role="status"
            >
              <span className={styles.feedbackMessage}>
                {applyFeedback.type === 'success' ? <CircleCheck size={17} aria-hidden /> : <CircleX size={17} aria-hidden />}
                {applyFeedback.message}
              </span>
              <button
                type="button"
                className={styles.dismissFeedback}
                aria-label={copy('Dismiss message', 'Đóng thông báo')}
                onClick={() => setApplyFeedback(null)}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          ) : null}

          <div className={styles.exploreSearch}>
            <Search size={17} className={styles.exploreSearchIcon} aria-hidden />
            <input
              type="search"
              className={styles.exploreInput}
              placeholder={copy('Search by group, lecturer, or topic', 'Tìm theo tên nhóm, giảng viên, đề tài')}
              value={exploreSearch}
              onChange={(e) => setExploreSearch(e.target.value)}
              aria-label={copy('Search research groups', 'Tìm nhóm nghiên cứu')}
            />
          </div>

          {loadingAllGroups ? (
            <SkeletonRow count={4} rowHeight={88} gap={12} />
          ) : filteredAllGroups.length === 0 ? (
            <EmptyState
              icon={<Inbox size={24} />}
              title={copy('No research groups found', 'Không tìm thấy nhóm nghiên cứu')}
              description={copy(
                'Try another search term or check your connection.',
                'Thử thay đổi từ khoá tìm kiếm hoặc kiểm tra lại kết nối.',
              )}
            />
          ) : (
            <ul className={styles.groupList}>
              {filteredAllGroups.map((g) => {
                const groupId = g.id ?? g.researchGroupId;
                if (!groupId) return null;
                const memberCount = g.memberCount ?? (g.members?.length ?? 0);
                const isFull = memberCount >= 5;
                const isAlreadyJoined = joinedGroupIds.has(groupId);
                const alreadyJoinedGroup = joinedGroups.find((jg) => jg.id === groupId);
                const isPendingJoin = alreadyJoinedGroup?.activityStatus === 'Pending' || alreadyJoinedGroup?.activityStatus === 'PENDING';
                const isApplying = applyingGroupId === groupId;
                return (
                  <li key={groupId} className={styles.groupCard}>
                    <div className={styles.groupCardLeft}>
                      <span className={styles.groupIconCircle} aria-hidden>
                        <Users size={22} />
                      </span>
                      <div className={styles.groupInfo}>
                        <div className={styles.groupTitleRow}>
                          <h3 className={styles.groupName}>{g.name ?? `Group #${groupId}`}</h3>
                          {isFull ? (
                            <span className={styles.capacityFullBadge}>
                              <CircleX size={13} aria-hidden />
                              {copy(`Full: ${memberCount}/5`, `Đã đủ ${memberCount}/5`)}
                            </span>
                          ) : (
                            <span className={styles.capacityBadge}>
                              <Users size={13} aria-hidden />
                              {copy(`${memberCount}/5 members`, `${memberCount}/5 thành viên`)}
                            </span>
                          )}
                        </div>
                        <div className={styles.groupMetaRow}>
                          <span>
                            <Mail size={12} />
                            {copy('Lecturer', 'Giảng viên')}: {g.lecturerName ?? lecturerNameFor(g.lecturerId)}
                          </span>
                          {g.deadline ? (
                            <span>
                              <Calendar size={12} />
                              {copy('Deadline', 'Hạn')}: {new Date(g.deadline).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium' })}
                            </span>
                          ) : null}
                        </div>
                        {g.description ? (
                          <p className={styles.groupDescription}>{g.description}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className={styles.groupActions}>
                      {isAlreadyJoined && !isPendingJoin ? (
                        <span className={styles.completedBadge}>
                          <CircleCheck size={14} aria-hidden />
                          {copy('Joined', 'Đã tham gia')}
                        </span>
                      ) : isPendingJoin ? (
                        <span className={styles.pendingBadge}>
                          <Clock3 size={13} aria-hidden />
                          {t('student.researchGroups.pending', 'Đang chờ duyệt')}
                        </span>
                      ) : isFull ? (
                        <span className={styles.fullButton}>
                          {t('student.researchGroups.full', 'Nhóm này đã đủ thành viên')}
                        </span>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={isApplying}
                          leftIcon={isApplying ? <Loader2 size={13} className={styles.spin} /> : undefined}
                          onClick={() => void handleApplyGroup(g)}
                        >
                          {isApplying ? copy('Sending application', 'Đang gửi đơn') : t('student.researchGroups.apply', 'Xin gia nhập nhóm')}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

// ---------- WorkspaceView ----------

interface WorkspaceViewProps {
  group: import('../../services/groupMembership.service').StudentGroupView;
  lecturerName: string;
  reports: SubmittedPhasedReport[];
  reportsLoading: boolean;
  searchText: string;
  onSearchChange: (next: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (next: StatusFilter) => void;
  onBack: () => void;
  onOpenSubmit: (report?: SubmittedPhasedReport) => void;
  isSubmitting: boolean;
  submittingReport: boolean;
  resubmittingReport: SubmittedPhasedReport | null;
  lastSubmitted: SubmittedPhasedReport | null;
  onCloseSubmit: () => void;
  onSubmitted: (report: SubmittedPhasedReport) => Promise<void> | void;
  onRefresh: () => Promise<void>;
  studentId: number | null;
  phaseKey: string;
  phaseTitle: string;
}

function WorkspaceView({
  group,
  lecturerName,
  reports,
  reportsLoading,
  searchText,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onBack,
  onOpenSubmit,
  isSubmitting,
  submittingReport,
  resubmittingReport,
  lastSubmitted,
  onCloseSubmit,
  onSubmitted,
  onRefresh,
  studentId,
  phaseKey,
  phaseTitle,
}: WorkspaceViewProps): JSX.Element {
  const { t } = useI18n();
  const locale = useLocale();
  const copy = (en: string, vi: string): string => (locale === 'en' ? en : vi);
  const lecturerId = group.lecturerId;

  // Default sort by submitted (newest first) so recently submitted
  // reports surface at the top. The user can override per column.
  const reportsSort =
    useTableSort<SubmittedPhasedReport, ReportsSortColumn>('submitted', 'desc');

  // Phase Reports table — sorted + status-filtered client-side before
  // pagination so the column sort and inline status dropdown affect
  // every page of the result set.
  const STATUS_FILTER_OPTIONS = [
    { value: 'all' as const, label: copy('All statuses', 'Tất cả trạng thái') },
    { value: 'WAITING' as const, label: copy('Waiting', 'Đang chờ') },
    { value: 'SUBMITTED' as const, label: copy('Submitted', 'Đã nộp') },
    { value: 'EVALUATED' as const, label: copy('Evaluated', 'Đã đánh giá') },
    { value: 'REJECTED' as const, label: copy('Rejected', 'Đã từ chối') },
  ];

  const sortedFilteredReports = useMemo(() => {
    const lowered = searchText.trim().toLowerCase();
    const base = reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (lowered.length === 0) return true;
      const haystack = [
        `Report #${r.id}`,
        r.status,
        r.finalOutcomeEvaluation ?? '',
        r.capacityEvaluation ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(lowered);
    });
    return reportsSort.sortedItemsBy(base, (report) => {
      switch (reportsSort.sortState.column) {
        case 'phase':
          return report.phaseNumber ?? report.id ?? null;
        case 'milestone':
          return report.milestoneTitle ?? '';
        case 'submitted':
          return report.submittedAt ?? null;
        case 'deadline':
          return report.deadlineAt ?? null;
        case 'score':
          return report.lectureFeedback ?? null;
        case 'status':
        default:
          return report.status;
      }
    });
  }, [reports, searchText, statusFilter, reportsSort]);

  const {
    page: reportsTablePage,
    totalPages: reportsTotalPages,
    totalItems: reportsTotalItems,
    startIndex: reportsStartIndex,
    endIndex: reportsEndIndex,
    pageItems: pagedReports,
    setPage: setReportsPage,
    next: nextReportsPage,
    prev: prevReportsPage,
    resetPage: resetReportsPage,
  } = usePagination<SubmittedPhasedReport>(
    sortedFilteredReports,
    DEFAULT_PAGE_SIZE,
  );

  useEffect(() => {
    resetReportsPage();
  }, [searchText, statusFilter, reportsSort.sortState, resetReportsPage]);

  // Part 3 — keyboard shortcuts for the milestone-reports table.
  // j/k navigate rows, Enter opens the PDF if available,
  // f focuses the toolbar search input.
  const { selectedIndex } = useListShortcuts({
    itemCount: pagedReports.length,
    onOpen: (index) => {
      const report = pagedReports[index];
      if (report?.reportFileUrl) {
        window.open(report.reportFileUrl, '_blank', 'noopener,noreferrer');
      }
    },
  });

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState<boolean>(true);
  useEffect(() => {
    let cancelled = false;
    setMembersLoading(true);
    void groupMemberService
      .getMembersForGroup(group.id)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  const currentMember = useMemo(
    () => members.find((member) => member.studentId === studentId) ?? null,
    [members, studentId],
  );
  const isCurrentUserLeader = Boolean(currentMember?.isLeader || group.isLeader);

  const { materials, isLoading: materialsLoading } = useLearningMaterials({
    lecturerId,
  });
  const visibleMaterials = useMemo<LearningMaterial[]>(() => {
    if (materials.length === 0) return [];
    if (typeof group.topicId === 'number' && group.topicId > 0) {
      const filtered = materials.filter(
        (m) => m.subFieldId === group.topicId || m.subFieldId === null,
      );
      return filtered.length > 0 ? filtered : materials;
    }
    return materials;
  }, [materials, group.topicId]);

  const latestRejected = useMemo<SubmittedPhasedReport | null>(
    () => reports.find((r) => r.status === 'REJECTED') ?? null,
    [reports],
  );

  const [viewDetailReport, setViewDetailReport] = useState<SubmittedPhasedReport | null>(null);

  return (
    <div className={styles.page}>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft size={14} />}
        onClick={onBack}
        className={styles.backLinkBtn}
      >
        {copy('Back to Research Groups', 'Quay lại danh sách nhóm')}
      </Button>

      <PageHeader
        eyebrow={copy('GROUP WORKSPACE', 'KHÔNG GIAN NHÓM')}
        title={group.name}
        description={`${copy('Supervised by', 'Giảng viên hướng dẫn')}: ${lecturerName}${
          group.description ? ` · ${group.description}` : ''
        }`}
        accent={ROLE_ACCENT}
        actions={
          isCurrentUserLeader ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FileText size={14} />}
              onClick={() => onOpenSubmit()}
            >
              {copy('Submit milestone report', 'Nộp báo cáo giai đoạn')}
            </Button>
          ) : (
            <span className={styles.permissionNote} role="status">
              {copy('Only your Group Leader can submit this phase report.', 'Chỉ Trưởng nhóm (Leader) mới có thể nộp báo cáo giai đoạn này.')}
            </span>
          )
        }
      />

      <BackendGapBanner
        field="ProjectGuideline and phase-group task"
        feature="Guidelines and group-specific phase instructions"
      />

      {latestRejected ? (
        <RejectionFeedbackBanner
          report={latestRejected}
          lecturerName={lecturerName}
          onResubmit={isCurrentUserLeader ? onOpenSubmit : undefined}
        />
      ) : null}

      <section className={styles.card}>
        <MilestoneProgress reports={reports} />
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{copy('Learning materials', 'Tài liệu học tập')}</h3>
          <p className={styles.sectionSubtitle}>
            {copy('Shared by your lecturer. Files appear here once published.', 'Được chia sẻ bởi giảng viên. Tệp sẽ xuất hiện ở đây sau khi được tải lên.')}
          </p>
        </div>
        {materialsLoading ? (
          <SkeletonRow count={2} rowHeight={48} gap={12} />
        ) : visibleMaterials.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={24} />}
            title={copy('No learning materials yet', 'Chưa có tài liệu học tập nào')}
            description={copy('Lecturer materials will appear here once they publish them for this group.', 'Tài liệu từ giảng viên sẽ hiển thị ở đây khi được chia sẻ cho nhóm này.')}
            compact
          />
        ) : (
          <ul className={styles.materialList}>
            {visibleMaterials.map((m) => (
              <li key={m.id ?? m.learningMaterialId ?? m.title} className={styles.materialItem}>
                <span className={styles.materialTitle}>{m.title ?? copy('Untitled material', 'Tài liệu chưa đặt tên')}</span>
                {m.fileUrl ? (
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.linkBtn}
                  >
                    {copy('Open PDF', 'Xem PDF')}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{copy('Group members', 'Thành viên nhóm')}</h3>
          <p className={styles.sectionSubtitle}>
            {copy('Other students assigned to this group.', 'Các sinh viên khác tham gia vào nhóm nghiên cứu này.')}
          </p>
        </div>
        {membersLoading ? (
          <SkeletonRow count={2} rowHeight={48} gap={12} />
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title={copy('No fellow members yet', 'Chưa có thành viên nào khác')}
            description={copy('Other students in this group will appear here once they join.', 'Các sinh viên khác trong nhóm sẽ xuất hiện ở đây khi tham gia.')}
            compact
          />
        ) : (
          <ul className={styles.memberList}>
            {members.map((m) => (
              <li key={m.id ?? m.groupMemberId} className={styles.memberItem}>
                <span className={styles.memberLabel}>
                  {copy('Student', 'Sinh viên')} #{m.studentId ?? '?'}
                </span>
                <span className={styles.activityPill}>
                  {m.activityStatus ?? 'ACTIVE'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>{copy('Milestone Reports (Phase Reports)', 'Báo cáo giai đoạn (Phase Reports)')}</h3>
          {!isCurrentUserLeader && (
            <p className={styles.permissionNote} role="status">
              {copy('You are a group member. Only the Group Leader can submit progress reports.', 'Bạn là thành viên nhóm. Chỉ Trưởng nhóm (Leader) mới có thể nộp báo cáo tiến độ.')}
            </p>
          )}
        </div>

        <TableToolbar
          search={searchText}
          onSearchChange={onSearchChange}
          onRefresh={onRefresh}
          isRefreshing={reportsLoading}
          searchPlaceholder={copy('Search by phase, status, or feedback…', 'Tìm kiếm theo giai đoạn, trạng thái, hoặc nhận xét…')}
          refreshLabel={copy('Refresh', 'Làm mới')}
          filters={
            <label className={styles.filterField}>
              <select
                value={statusFilter}
                onChange={(e) =>
                  onStatusFilterChange(e.target.value as StatusFilter)
                }
                aria-label={copy('Filter reports by status', 'Lọc báo cáo theo trạng thái')}
              >
                <option value="all">{copy('All statuses', 'Tất cả trạng thái')}</option>
                <option value="WAITING">{copy('Waiting', 'Đang chờ')}</option>
                <option value="SUBMITTED">{copy('Submitted', 'Đã nộp')}</option>
                <option value="EVALUATED">{copy('Evaluated', 'Đã đánh giá')}</option>
                <option value="REJECTED">{copy('Rejected', 'Đã từ chối')}</option>
              </select>
            </label>
          }
        />

        {reportsLoading ? (
          <SkeletonRow count={4} rowHeight={40} gap={8} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<Inbox size={24} />}
            title={copy('No reports yet', 'Chưa có báo cáo nào')}
            description={isCurrentUserLeader ? copy('Use the Submit button on each Phase row below to upload a report.', 'Nhấn nút Nộp tại từng giai đoạn bên dưới để tải lên báo cáo.') : copy('The group leader has not submitted any phase reports yet.', 'Trưởng nhóm chưa nộp báo cáo giai đoạn nào.')}
            compact
          />
        ) : reportsTotalItems === 0 ? (
          <EmptyState
            icon={<Inbox size={24} />}
            title={copy('No matching reports', 'Không tìm thấy báo cáo phù hợp')}
            description={copy('No reports match the current filters.', 'Không có báo cáo nào khớp với bộ lọc hiện tại.')}
            compact
          />
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>
                      <SortableHeader
                        column="phase"
                        label={copy('Phase', 'Giai đoạn')}
                        cycleSort={reportsSort.cycleSort}
                        ariaSortFor={reportsSort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="milestone"
                        label={copy('Milestone', 'Cột mốc')}
                        cycleSort={reportsSort.cycleSort}
                        ariaSortFor={reportsSort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="submitted"
                        label={copy('Submitted', 'Ngày nộp')}
                        cycleSort={reportsSort.cycleSort}
                        ariaSortFor={reportsSort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="deadline"
                        label={copy('Deadline', 'Hạn nộp')}
                        cycleSort={reportsSort.cycleSort}
                        ariaSortFor={reportsSort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="status"
                        label={copy('Status', 'Trạng thái')}
                        cycleSort={reportsSort.cycleSort}
                        ariaSortFor={reportsSort.ariaSortFor}
                        filterOptions={STATUS_FILTER_OPTIONS}
                        activeFilter={statusFilter}
                        onFilterChange={(next) =>
                          onStatusFilterChange(next as StatusFilter)
                        }
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="score"
                        label={copy('Score', 'Điểm')}
                        cycleSort={reportsSort.cycleSort}
                        ariaSortFor={reportsSort.ariaSortFor}
                        align="right"
                      />
                    </th>
                    <th>{copy('Action', 'Thao tác')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedReports.map((report, index) => {
                    const canSubmit = isCurrentUserLeader && (
                      report.status === 'Pending' ||
                      report.status === 'WAITING' ||
                      report.status === 'REJECTED' ||
                      !report.submittedAt
                    );
                    const isSubmitted = report.submittedAt || report.status === 'Passed' || report.status === 'SUBMITTED' || report.status === 'EVALUATED';
                    return (
                      <tr
                        key={report.id}
                        data-testid="srg-row"
                        className={selectedIndex === index ? styles.selectedRow : ''}
                      >
                        <td>
                          <span className={styles.reportIdPill}>
                            Phase {report.phaseNumber ?? report.id}
                          </span>
                        </td>
                        <td>
                          <span className={styles.milestoneName}>
                            {report.milestoneTitle || `Phase ${report.phaseNumber ?? report.id}`}
                          </span>
                        </td>
                        <td>
                          {report.submittedAt ? (
                            <span className={styles.dateText}>
                              <Calendar size={12} />
                              {new Date(report.submittedAt).toLocaleDateString(
                                locale === 'en' ? 'en-US' : 'vi-VN',
                                { dateStyle: 'medium' },
                              )}
                            </span>
                          ) : (
                            <span className={styles.mutedText}>
                              {t('student.phaseReport.notSubmitted', 'Chưa nộp')}
                            </span>
                          )}
                        </td>
                        <td>
                          {report.deadlineAt ? (
                            <span className={`${styles.dateText} ${report.isOverdue ? styles.overdueDate : ''}`}>
                              <Calendar size={12} />
                              {new Date(report.deadlineAt).toLocaleDateString(
                                locale === 'en' ? 'en-US' : 'vi-VN',
                                { dateStyle: 'medium' },
                              )}
                              {report.isOverdue ? (
                                <span className={styles.overdueLabel}>
                                  {t('student.phaseReport.overdue', 'Quá hạn')}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className={styles.mutedText}>—</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={report.status} size="sm" />
                        </td>
                        <td>
                          {typeof report.lectureFeedback === 'number' ? (
                            <span className={styles.scoreValue}>
                              {report.lectureFeedback}/10
                            </span>
                          ) : (
                            <span className={styles.mutedText}>—</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.rowActions}>
                            {/* View detail button — visible to all */}
                            {isSubmitted ? (
                              <button
                                type="button"
                                className={styles.detailBtn}
                                onClick={() => setViewDetailReport(report)}
                              >
                                <FileText size={12} aria-hidden />
                                {t('student.phaseReport.viewDetail', 'Xem chi tiết')}
                              </button>
                            ) : null}
                            {report.reportFileUrl ? (
                              <a
                                href={report.reportFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.linkBtn}
                              >
                                {copy('Open PDF', 'Xem PDF')}
                              </a>
                            ) : null}
                            {/* Leader only: Submit or Resubmit */}
                            {isCurrentUserLeader && canSubmit ? (
                              <button
                                type="button"
                                className={styles.submitPhaseBtn}
                                onClick={() => {
                                  onOpenSubmit(report.status === 'REJECTED' ? report : undefined);
                                }}
                              >
                                {report.status === 'REJECTED'
                                  ? t('student.phaseReport.resubmit', 'Nộp lại')
                                  : `${t('student.phaseReport.submit', 'Nộp Phase')} ${report.phaseNumber ?? ''}`}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={reportsTablePage}
              totalPages={reportsTotalPages}
              totalItems={reportsTotalItems}
              startIndex={reportsStartIndex}
              endIndex={reportsEndIndex}
              onPrev={prevReportsPage}
              onNext={nextReportsPage}
              onPage={setReportsPage}
              itemLabel={copy('reports', 'báo cáo')}
            />
          </>
        )}
      </section>

      {submittingReport ? (
        <SubmitReportModal
          isOpen={submittingReport}
          researchGroupId={group.id}
          groupMemberId={currentMember?.id ?? currentMember?.groupMemberId ?? undefined}
          phaseKey={phaseKey}
          phaseTitle={phaseTitle}
          lecturerName={lecturerName}
          resubmittingReport={resubmittingReport}
          isSubmitting={isSubmitting}
          lastSubmitted={lastSubmitted}
          onClose={onCloseSubmit}
          onSubmitted={onSubmitted}
        />
      ) : null}

      <PhaseReportDetailModal
        isOpen={viewDetailReport !== null}
        report={viewDetailReport}
        groupName={group.name}
        lecturerName={lecturerName}
        onClose={() => setViewDetailReport(null)}
      />
    </div>
  );
}

export default StudentResearchGroups;

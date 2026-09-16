/**
 * StudentResearchGroups — Research Journey
 * ARS Research Constellation — Graduate Student workspace
 *
 * Two surfaces:
 *  - Overview: list of joined groups with an invitation banner
 *  - Workspace (per group): learning materials, group members, and phase
 *    reports
 *
 * Design rules applied:
 *  - PageHeader + role accent `--ars-gradstudent`
 *  - Shared `EmptyState`, `ErrorBanner`, `SkeletonRow`, `StatusBadge`
 *  - Tables use `TableToolbar` + `TablePagination`
 *  - No inline styles in JSX (CSS Modules only)
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../../routes/paths';
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
import { groupMemberService, type GroupMember } from '../../services/groupMember.service';
import { getAllGroupMembers } from '../../services/groupMembership.service';
import { researchGroupService, type ResearchGroup } from '../../services/researchGroup.service';
import { groupJoinRequestService } from '../../services/groupJoinRequest.service';
import { lecturerLookupService } from '../../services/lecturerLookup.service';
import InvitationBanner from '../../components/gradstudent/InvitationBanner';
import RejectionFeedbackBanner from '../../components/gradstudent/RejectionFeedbackBanner';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { SortableHeader } from '../../components/table/SortableHeader';
import { usePagination } from '../../hooks/usePagination';
import { useTableSort } from '../../hooks/useTableSort';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import { derivePhasedReportDisplay } from '../../utils/phasedReport';
import {
  derivePhaseMaterialsForGroup,
  type PhaseMaterialEntry,
} from '../../utils/phaseMaterials';
import { useListShortcuts } from '../../hooks/useListShortcuts';
import type { SubmittedPhasedReport } from '../../services/phasedReport.service';
import { safeHref } from '../../utils/validationRules';
import styles from './StudentResearchGroups.module.css';

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
  const [lecturerNames, setLecturerNames] = useState<Record<number, string>>({});

  const { joinedGroups, isLoading, error, refetch } =
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
      setApplyFeedback({
        type: 'error',
        message: copy(
          `This research group already has ${memberCount} members and cannot accept another application.`,
          `Nhóm nghiên cứu đã đủ ${memberCount} thành viên và không thể nhận thêm đơn xin gia nhập.`,
        ),
      });
      return;
    }
    const groupId = group.id ?? group.researchGroupId;
    if (!groupId) return;
    setApplyingGroupId(groupId);
    setApplyFeedback(null);
    try {
      await groupJoinRequestService.applyToGroup(groupId);

      setApplyFeedback({
        type: 'success',
        message: copy(
          `Application to join "${group.name}" submitted successfully! Please wait for lecturer approval.`,
          `Đã nộp đơn xin gia nhập nhóm "${group.name}" thành công! Vui lòng chờ giảng viên phê duyệt.`,
        ),
      });
      await refetch();
      await loadAllGroups();
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = errorObj.response?.status;
      let message = errorObj.response?.data?.message || errorObj.message;
      if (status === 409) {
        message = copy(
          'You already have a pending application or are already a member of this group.',
          'Bạn đã có đơn chờ duyệt hoặc đã là thành viên của nhóm này.',
        );
      } else if (!message) {
        message = copy(
          'We could not submit your application to join this research group.',
          'Không thể gửi đơn xin gia nhập nhóm.',
        );
      }
      setApplyFeedback({
        type: 'error',
        message,
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
    return Array.from(ids);
  }, [joinedGroups, selectedGroup]);

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
        onRefresh={handleRefresh}
        studentId={studentId}
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
          joinedGroups.length > 0
            ? `${copy('You have joined', 'Bạn đã tham gia')} ${joinedGroups.length} ${copy('research group(s).', 'nhóm nghiên cứu.')}`
            : copy('Join a research group to begin your journey.', 'Hãy tham gia một nhóm nghiên cứu để bắt đầu.')
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
                              {t('student.researchGroups.leader', 'Group Leader')}
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
  onRefresh: () => Promise<void>;
  studentId: number | null;
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
  onRefresh,
  studentId,
}: WorkspaceViewProps): JSX.Element {
  const { t } = useI18n();
  const locale = useLocale();
  const copy = (en: string, vi: string): string => (locale === 'en' ? en : vi);

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

  // When the lecturer deactivates the group, the workspace must clearly
  // surface that and block any further submissions. `group.isActive` is
  // the FE-canonical flag (defaulting to active when undefined for
  // legacy rows that pre-date the BE column).
  const isGroupActive = group.isActive !== false;

  // Materials for the Research Group workspace are sourced from THIS
  // group's PhasedReport rows, NOT from the lecturer's global Learning
  // Material library. The lecturer must explicitly attach a material to a
  // phase via "Manage phase" — only those attachments surface here. See
  // `src/utils/phaseMaterials.ts` for the rationale and contract.
  //
  // Loading is tied to the PhasedReport fetch so we don't double-call the
  // API: the same `reportsLoading` already drives the milestone table
  // skeleton, and there is no separate materials endpoint to wait for.
  const phaseMaterials = useMemo<PhaseMaterialEntry[]>(
    () => derivePhaseMaterialsForGroup(reports),
    [reports],
  );
  const materialsLoading = reportsLoading;

  const latestRejected = useMemo<SubmittedPhasedReport | null>(
    () => reports.find((r) => r.status === 'REJECTED') ?? null,
    [reports],
  );

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
          // Submission flow lives on the dedicated Submit Report tab — see
          // `routes/paths.ts:SUBMIT_REPORT`. The Group Workspace is
          // view-only for milestones by design (the user explicitly asked
          // for this separation in the August 2026 spec). We still leave
          // a primary CTA that nudges leaders to the dedicated tab.
          <Link
            to={`${ROUTES.SUBMIT_REPORT}?groupId=${group.id}`}
            className={styles.submitCtaLink}
          >
            <FileText size={14} aria-hidden />
            {copy(
              'Go to Submit Report tab',
              'Mở tab Nộp báo cáo',
            )}
          </Link>
        }
      />

      {!isGroupActive ? (
        <p className={styles.permissionNote} role="status">
          {copy(
            'This group is inactive. Submissions are paused until your lecturer reactivates the group.',
            'Nhóm này đang ở trạng thái không hoạt động. Việc nộp báo cáo tạm dừng cho đến khi giảng viên kích hoạt lại nhóm.',
          )}
        </p>
      ) : !isCurrentUserLeader ? (
        <p className={styles.permissionNote} role="status">
          {copy(
            'You are a group member. Submission is restricted to the Group Leader on the Submit Report tab.',
            'Bạn là thành viên nhóm. Việc nộp báo cáo chỉ dành cho Trưởng nhóm tại tab Nộp báo cáo.',
          )}
        </p>
      ) : null}

      {latestRejected ? (
        <RejectionFeedbackBanner
          report={latestRejected}
          lecturerName={lecturerName}
        />
      ) : null}

      {latestRejected && isCurrentUserLeader ? (
        <p className={styles.resubmitRedirect} role="status">
          {copy(
            'Read the lecturer’s feedback above. To resubmit a corrected report, open the Submit Report tab — the rejected row will have a Resubmit button.',
            'Đọc phản hồi của giảng viên ở trên. Để nộp lại báo cáo đã chỉnh sửa, hãy mở tab Nộp báo cáo — hàng bị từ chối sẽ có nút Nộp lại.',
          )}
        </p>
      ) : null}

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{copy('Learning materials', 'Tài liệu học tập')}</h3>
          <p className={styles.sectionSubtitle}>
            {copy(
              'Attached by your lecturer to each milestone of this group\u2019s research topic.',
              'Được giảng viên đính kèm vào từng mốc của đề tài nghiên cứu mà nhóm này đang thực hiện.',
            )}
          </p>
        </div>
        {materialsLoading ? (
          <SkeletonRow count={2} rowHeight={48} gap={12} />
        ) : phaseMaterials.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={24} />}
            title={copy('No materials attached yet', 'Chưa có tài liệu nào được đính kèm')}
            description={copy(
              'Your lecturer hasn\u2019t attached any materials to this group\u2019s phase milestones yet. They can do so via \u201cManage phase\u201d on the topic.',
              'Giảng viên của bạn chưa đính kèm tài liệu nào cho các mốc của nhóm này. Họ có thể thực hiện qua mục \u201cQuản lý giai đoạn\u201d trên đề tài.',
            )}
            compact
          />
        ) : (
          <ul className={styles.materialList}>
            {phaseMaterials.map((m) => (
              <li
                key={`phase-material-${m.phasedReportId}`}
                className={styles.materialItem}
              >
                <span className={styles.materialTitle}>
                  {copy('Phase ', 'Giai đoạn ')}
                  {m.phaseNumber}
                  {m.milestoneTitle ? ` · ${m.milestoneTitle}` : ''}
                </span>
                {safeHref(m.materialUrl) ? (
                  <a
                    href={safeHref(m.materialUrl) ?? '#'}
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
          <p className={styles.tableSubtitle}>
            {copy(
              'Read-only here. Submissions are handled on the dedicated Submit Report tab.',
              'Chỉ xem tại đây. Việc nộp báo cáo được thực hiện ở tab Nộp báo cáo chuyên dụng.',
            )}
          </p>
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
                          {report.deadlineAt ? (() => {
                            // Bug fix (Sep 2026): trust the shared
                            // derivation helper instead of `report.isOverdue`
                            // directly. See SubmitReport.tsx for the full
                            // rationale — same BE endpoint, same problem.
                            const display = derivePhasedReportDisplay(report);
                            return (
                              <span className={`${styles.dateText} ${display.overdue ? styles.overdueDate : ''}`}>
                                <Calendar size={12} />
                                {new Date(report.deadlineAt).toLocaleDateString(
                                  locale === 'en' ? 'en-US' : 'vi-VN',
                                  { dateStyle: 'medium' },
                                )}
                                {display.overdue ? (
                                  <span className={styles.overdueLabel}>
                                    {t('student.phaseReport.overdue', 'Quá hạn')}
                                  </span>
                                ) : null}
                              </span>
                            );
                          })() : (
                            <span className={styles.mutedText}>—</span>
                          )}
                        </td>
                        <td>
                          {(() => {
                            const display = derivePhasedReportDisplay(report);
                            const badgeStatus =
                              display.badge === 'Pending' && report.status
                                ? report.status
                                : display.badge;
                            return <StatusBadge status={badgeStatus} size="sm" />;
                          })()}
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
                            {/* View PDF — only when an actual file is on
                                file. The detail-with-feedback flow has
                                moved to the Submit Report tab so the
                                leader can resubmit from the same
                                context; this page stays read-only. */}
                            {report.reportFileUrl && safeHref(report.reportFileUrl) ? (
<a
                              href={safeHref(report.reportFileUrl) ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.linkBtn}
                            >
                              <FileText size={12} aria-hidden />
                              {copy('Open PDF', 'Xem PDF')}
                            </a>
                          ) : null}
                            {/* Submission flow moved to the dedicated
                                Submit Report tab. The Group Workspace is
                                strictly view-only — leaders and members
                                both read the row state here and click
                                "Go to Submit Report tab" in the page
                                header to upload. When the lecturer
                                deactivates the group the status badge
                                alone tells the student submissions are
                                paused. */}
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

      </div>
  );
}

export default StudentResearchGroups;

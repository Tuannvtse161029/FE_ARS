/**
 * StudentResearchGroups — Graduate Student research groups workspace
 *
 * Refactored from src/pages/GraduateStudent/StudentResearchGroups.tsx
 * Uses extracted components:
 *   - WorkspaceView (group workspace with milestones, materials, members)
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
import { StatusBadge } from '../../components/common/StatusBadge';
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
import { WorkspaceView } from './components/WorkspaceView';
// CSS module kept at the original StudentResearchGroups CSS location for now.
import styles from '../../pages/GraduateStudent/StudentResearchGroups.module.css';

const ROLE_ACCENT = 'var(--accent-primary)';

type StatusFilter = 'all' | 'WAITING' | 'SUBMITTED' | 'EVALUATED' | 'REJECTED';
type ReportsSortColumn = 'phase' | 'milestone' | 'submitted' | 'deadline' | 'score' | 'status';

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
      window.addEventListener('ars:lecturer-name-resolved', handler as EventListener);
      return () => window.removeEventListener('ars:lecturer-name-resolved', handler as EventListener);
    }
    return undefined;
  }, []);

  // Sync selected group from URL
  useEffect(() => {
    const gidParam = searchParams.get('groupId');
    if (gidParam) {
      const gidNum = Number(gidParam);
      if (gidNum > 0) setSelectedGroupId(gidNum);
    }
  }, [searchParams]);

  // Load all research groups
  const loadAllGroups = async () => {
    setLoadingAllGroups(true);
    try {
      let list: ResearchGroup[] = [];
      try {
        list = await researchGroupService.getAll();
      } catch (primaryErr) {
        console.warn('[ResearchGroups] getAll failed, trying fallback:', primaryErr);
        const allMembers = await getAllGroupMembers().catch(() => []);
        const uniqueGroupIds = [...new Set(
          allMembers.map((m: { researchGroupId?: number }) => m.researchGroupId).filter(Boolean)
        )] as number[];
        const results = await Promise.allSettled(
          uniqueGroupIds.map((gid) => researchGroupService.getById(gid))
        );
        list = results
          .filter((r): r is PromiseFulfilledResult<ResearchGroup> => r.status === 'fulfilled')
          .map((r) => r.value);
      }
      setAllGroups(list);
    } catch (err) {
      console.error('[ResearchGroups] loadAllGroups failed:', err);
    } finally {
      setLoadingAllGroups(false);
    }
  };

  useEffect(() => { void loadAllGroups(); }, []);

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

      // Optimistic localStorage save
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const key = `student_pending_groups_${studentId}`;
          const raw = window.localStorage.getItem(key);
          const currentList: number[] = raw ? JSON.parse(raw) : [];
          if (!currentList.includes(groupId)) {
            currentList.push(groupId);
            window.localStorage.setItem(key, JSON.stringify(currentList));
          }
        } catch { /* ignore */ }
      }

      if (group.lecturerId) {
        try {
          await notificationService.create({
            userId: group.lecturerId,
            message: `[Group] membership: Sinh viên ${user.username} đã nộp đơn xin gia nhập nhóm "${group.name}".`,
          });
        } catch { /* ignore */ }
      }

      setApplyFeedback({
        type: 'success',
        message: `Đã nộp đơn xin gia nhập nhóm "${group.name}" thành công!`,
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
      if (typeof g.lecturerId === 'number' && g.lecturerId > 0) ids.add(g.lecturerId);
    });
    if (selectedGroup && typeof selectedGroup.lecturerId === 'number') ids.add(selectedGroup.lecturerId);
    if (guidanceProject && typeof guidanceProject.lecturerId === 'number') ids.add(guidanceProject.lecturerId);
    return Array.from(ids);
  }, [joinedGroups, selectedGroup, guidanceProject]);

  useEffect(() => {
    uniqueLecturerIds.forEach((id) => {
      lecturerLookupService.ensureLecturerDisplayName(id);
    });
  }, [uniqueLecturerIds]);

  const lecturerNameFor = (lecturerId: number | null | undefined): string => {
    if (typeof lecturerId !== 'number' || lecturerId <= 0) return 'Lecturer';
    const cached = lecturerNames[lecturerId];
    if (cached) return cached;
    return lecturerLookupService.getLecturerDisplayName(lecturerId);
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <ErrorBanner tone="error" message="Please sign in to view your research groups." />
      </div>
    );
  }

  if (selectedGroup) {
    const lecturerId = selectedGroup.lecturerId;
    return (
      <WorkspaceView
        group={selectedGroup}
        lecturerName={lecturerNameFor(lecturerId)}
        reports={reports}
        reportsLoading={reportsLoading}
        onBack={() => setSelectedGroupId(null)}
        onRefresh={async () => { await refetch(); await refetchReports(); }}
        studentId={studentId}
      />
    );
  }

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
            leftIcon={isLoading ? <Loader2 size={13} className={styles.spin} /> : <RefreshCw size={13} />}
            onClick={() => void refetch()}
            disabled={isLoading}
          >
            {copy('Refresh', 'Làm mới')}
          </Button>
        }
      />

      <InvitationBanner invitation={null} onAccept={() => undefined} onDecline={() => undefined} />

      {error ? <ErrorBanner tone="error" message={error.message} /> : null}

      {/* Tabs */}
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
              {copy('Groups you have joined or are waiting to join.', 'Các nhóm bạn đã tham gia hoặc đang chờ duyệt.')}
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
                      <span className={styles.groupIconCircle} aria-hidden><Users size={22} /></span>
                      <div className={styles.groupInfo}>
                        <div className={styles.groupTitleRow}>
                          <h3 className={styles.groupName}>{g.name}</h3>
                          {isPending ? (
                            <span className={styles.pendingBadge}><Clock3 size={13} aria-hidden />{t('student.researchGroups.pending', 'Chờ duyệt')}</span>
                          ) : (
                            <span className={styles.activityPill}>{g.activityStatus ?? 'ACTIVE'}</span>
                          )}
                          {g.isLeader ? (
                            <span className={styles.leaderBadge}><Crown size={13} aria-hidden />{t('student.researchGroups.leader', 'Trưởng nhóm')}</span>
                          ) : null}
                        </div>
                        <div className={styles.groupMetaRow}>
                          <span><Mail size={12} />{copy('Supervised by', 'Giảng viên hướng dẫn')} {lecturerNameFor(g.lecturerId)}</span>
                          <span><Calendar size={12} />{g.joinedAt ? `${copy('Joined', 'Đã tham gia')} ${new Date(g.joinedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium' })}` : copy('Recently joined', 'Mới tham gia')}</span>
                        </div>
                        {isPending ? <p className={styles.pendingExplanation}>{copy('Your application is awaiting lecturer review and approval.', 'Đơn xin gia nhập của bạn đang chờ Giảng viên xem xét và phê duyệt.')}</p> : null}
                        {g.description ? <p className={styles.groupDescription}>{g.description}</p> : null}
                      </div>
                    </div>
                    {isPending ? (
                      <Button variant="outline" size="sm" disabled leftIcon={<Clock3 size={13} />}>{t('student.researchGroups.pending', 'Đang chờ duyệt')}</Button>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => setSelectedGroupId(g.id)}>{t('student.researchGroups.openWorkspace', 'Mở không gian nhóm')}</Button>
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
            <h2 className={styles.sectionTitle}>{t('student.researchGroups.explore', 'Khám phá nhóm nghiên cứu')}</h2>
            <p className={styles.sectionSubtitle}>{copy('Find research groups that are accepting new members and submit an application.', 'Tìm kiếm và nộp đơn xin gia nhập các nhóm nghiên cứu đang tuyển thành viên.')}</p>
          </div>

          {applyFeedback && (
            <div className={applyFeedback.type === 'success' ? styles.applySuccessBanner : styles.applyErrorBanner} role="status">
              <span className={styles.feedbackMessage}>
                {applyFeedback.type === 'success' ? <CircleCheck size={17} aria-hidden /> : <CircleX size={17} aria-hidden />}
                {applyFeedback.message}
              </span>
              <button type="button" className={styles.dismissFeedback} aria-label="Dismiss" onClick={() => setApplyFeedback(null)}>
                <X size={16} aria-hidden />
              </button>
            </div>
          )}

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
            <EmptyState icon={<Inbox size={24} />} title={copy('No research groups found', 'Không tìm thấy nhóm nghiên cứu')} description={copy('Try another search term or check your connection.', 'Thử thay đổi từ khoá tìm kiếm hoặc kiểm tra lại kết nối.')} />
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
                      <span className={styles.groupIconCircle} aria-hidden><Users size={22} /></span>
                      <div className={styles.groupInfo}>
                        <div className={styles.groupTitleRow}>
                          <h3 className={styles.groupName}>{g.name ?? `Group #${groupId}`}</h3>
                          {isFull ? (
                            <span className={styles.capacityFullBadge}><CircleX size={13} aria-hidden />{copy(`Full: ${memberCount}/5`, `Đã đủ ${memberCount}/5`)}</span>
                          ) : (
                            <span className={styles.capacityBadge}><Users size={13} aria-hidden />{copy(`${memberCount}/5 members`, `${memberCount}/5 thành viên`)}</span>
                          )}
                        </div>
                        <div className={styles.groupMetaRow}>
                          <span><Mail size={12} />{copy('Lecturer', 'Giảng viên')}: {g.lecturerName ?? lecturerNameFor(g.lecturerId)}</span>
                          {g.deadline ? <span><Calendar size={12} />{copy('Deadline', 'Hạn')}: {new Date(g.deadline).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium' })}</span> : null}
                        </div>
                        {g.description ? <p className={styles.groupDescription}>{g.description}</p> : null}
                      </div>
                    </div>
                    <div className={styles.groupActions}>
                      {isAlreadyJoined && !isPendingJoin ? (
                        <span className={styles.completedBadge}><CircleCheck size={14} aria-hidden />{copy('Joined', 'Đã tham gia')}</span>
                      ) : isPendingJoin ? (
                        <span className={styles.pendingBadge}><Clock3 size={13} aria-hidden />{t('student.researchGroups.pending', 'Đang chờ duyệt')}</span>
                      ) : isFull ? (
                        <span className={styles.fullButton}>{t('student.researchGroups.full', 'Nhóm này đã đủ thành viên')}</span>
                      ) : (
                        <Button variant="primary" size="sm" disabled={isApplying} leftIcon={isApplying ? <Loader2 size={13} className={styles.spin} /> : undefined} onClick={() => void handleApplyGroup(g)}>
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

export default StudentResearchGroups;

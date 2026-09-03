// Lecturer — Research Groups (groups-only).
//
// Per the Coordinator brief, this page is groups-only. Topics CRUD was moved
// to a dedicated page (`ResearchTopics.tsx`). This page keeps the assigned-
// topic summary on every group card and links to the topic's row on the new
// page so the lecturer can navigate Groups → Topic without back/forward
// navigation.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Check,
  X,
  Users,
  Trash2,
  Loader,
  AlertTriangle,
  RefreshCw,
  Inbox,
  ArrowRight,
  Lightbulb,
  Crown,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import { toApiIsoString, formatDisplayDate } from '../../utils/datetime';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import { useResearchTopics } from '../../hooks/useResearchTopics';
import { useGuidanceProjects } from '../../hooks/useGuidanceProjects';
import {
  researchGroupService,
  deriveGroupStatus,
} from '../../services/researchGroup.service';
import type { ResearchTopic } from '../../types/research';
import {
  groupMemberService,
  indexGroupMembersByGroupId,
} from '../../services/groupMember.service';
import type { GroupMember } from '../../services/groupMember.service';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { FieldError } from '../../components/FieldError';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { usePagination } from '../../hooks/usePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import { Button } from '../../components/Button/Button';
import { ROUTES } from '../../routes/paths';
import styles from './ResearchGroup.module.css';

interface BannerState {
  visible: boolean;
  text: string;
  variant: 'success' | 'error';
}

const formatGroupId = (id: number): string =>
  `RG-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`;

const initialsOf = (raw: string): string =>
  raw
    .split(/\s+/)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

const avatarTones = ['green', 'amber', 'blue', 'purple', 'red'] as const;
type AvatarTone = (typeof avatarTones)[number] | 'muted';

const avatarToneAt = (idx: number): AvatarTone =>
  avatarTones[idx % avatarTones.length] ?? 'muted';

// Visual tone for the deadline pill in the card meta strip. Pairs color
// with an icon (already in the markup) and a text label (the due date),
// so the meaning is never carried by color alone.
const deadlineTone = (
  deadlineLabel: string,
): 'dueSoon' | 'overdue' | 'safe' => {
  if (!deadlineLabel) return 'safe';
  const parsed = new Date(deadlineLabel).getTime();
  if (Number.isNaN(parsed)) return 'safe';
  const dayMs = 24 * 60 * 60 * 1000;
  const delta = parsed - Date.now();
  if (delta < 0) return 'overdue';
  if (delta <= 7 * dayMs) return 'dueSoon';
  return 'safe';
};

export const ResearchGroup = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const locale = useLocale();
  const lecturerId = user?.userId ?? null;

  const {
    groups,
    isLoading: isLoadingGroups,
    error: groupsError,
    refetch: refetchGroups,
  } = useResearchGroups({ lecturerId });

  const sortedGroups = useMemo(
    () =>
      [...groups].sort(
        (a, b) =>
          new Date(b.assignedAt ?? 0).getTime() -
          new Date(a.assignedAt ?? 0).getTime(),
      ),
    [groups],
  );

  const {
    topics,
    isLoading: isLoadingTopics,
    error: topicsError,
    refetch: refetchTopics,
  } = useResearchTopics();

  const { refetch: refetchProjects } = useGuidanceProjects();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const loadMembers = async () => {
    setIsLoadingMembers(true);
    setMembersError(null);
    try {
      const list = await groupMemberService.getAll();
      setMembers(list);
    } catch (err) {
      setMembersError(
        err instanceof Error ? err.message : t('lecturer.researchGroups.failedToLoad'),
      );
      setMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    void loadMembers();
  }, []);

  const memberIndex = useMemo(
    () => indexGroupMembersByGroupId(members),
    [members],
  );

  const topicById = useMemo(() => {
    const map = new Map<number, ResearchTopic>();
    for (const t of topics) {
      if (typeof t.id === 'number') map.set(t.id, t);
    }
    return map;
  }, [topics]);

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    text: '',
    variant: 'success',
  });

  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupDeadline, setGroupDeadline] = useState('');
  const [groupNameError, setGroupNameError] = useState<string | null>(null);
  const [groupDeadlineError, setGroupDeadlineError] = useState<string | null>(
    null,
  );
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  const [groupSearch, setGroupSearch] = useState('');
  const [isRefreshingGroups, setIsRefreshingGroups] = useState(false);

  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return sortedGroups;
    return sortedGroups.filter((g) => {
      const t = g.topicId ? topicById.get(g.topicId) : null;
      const topicTitle = t?.title ?? '';
      return [g.name ?? '', g.description ?? '', topicTitle]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [sortedGroups, groupSearch, topicById]);

  const {
    page: groupPage,
    totalPages: groupTotalPages,
    totalItems: groupTotalItems,
    startIndex: groupStartIndex,
    endIndex: groupEndIndex,
    pageItems: pagedGroups,
    setPage: setGroupPage,
    next: nextGroupPage,
    prev: prevGroupPage,
    resetPage: resetGroupPage,
  } = usePagination(filteredGroups, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetGroupPage();
  }, [groupSearch, resetGroupPage]);

  const handleRefreshGroups = async () => {
    if (isRefreshingGroups) return;
    setIsRefreshingGroups(true);
    try {
      await refetchGroups();
    } finally {
      setIsRefreshingGroups(false);
    }
  };

  const showBannerMessage = (
    text: string,
    variant: 'success' | 'error' = 'success',
  ) => {
    setBanner({ visible: true, text, variant });
    window.setTimeout(
      () => setBanner({ visible: false, text: '', variant: 'success' }),
      4000,
    );
  };

  const handleDeleteGroup = async (groupId: number, name: string) => {
    const ok = window.confirm(t('lecturer.researchGroups.deleteConfirm'));
    if (!ok) return;
    try {
      await researchGroupService.delete(groupId);
      showBannerMessage(`"${name}" ${t('lecturer.researchGroups.deleteSuccess')}`);
      await refetchGroups();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('lecturer.researchGroups.deleteFailed');
      showBannerMessage(`${t('lecturer.researchGroups.deleteFailed')} ${message}`, 'error');
    }
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecturerId) {
      setCreateGroupError(t('lecturer.researchGroups.noLecturerSession'));
      return;
    }
    const trimmedName = groupName.trim();
    const nameErr = trimmedName ? null : t('lecturer.researchGroups.groupNameRequired');
    let deadlineErr: string | null = null;
    if (groupDeadline) {
      const ms = new Date(groupDeadline).getTime();
      if (Number.isNaN(ms)) deadlineErr = t('lecturer.researchGroups.deadlineInvalid');
    }
    setGroupNameError(nameErr);
    setGroupDeadlineError(deadlineErr);
    if (nameErr || deadlineErr) return;
    setIsCreatingGroup(true);
    setCreateGroupError(null);
    try {
      const created = await researchGroupService.create({
        lecturerId,
        topicId: null,
        name: trimmedName,
        description: groupDesc.trim() || null,
        deadline: groupDeadline ? toApiIsoString(groupDeadline) : null,
        assignedAt: null,
      });
      setShowCreateGroupModal(false);
      setGroupName('');
      setGroupDesc('');
      setGroupDeadline('');
      setGroupNameError(null);
      setGroupDeadlineError(null);
      const idLabel =
        typeof created.id === 'number' ? formatGroupId(created.id) : '';
      showBannerMessage(
        `${idLabel} ("${created.name ?? groupName}") ${t('lecturer.researchGroups.createdSuccess')}`,
      );
      await refetchGroups();
    } catch (err) {
      setCreateGroupError(
        err instanceof Error ? err.message : t('lecturer.researchGroups.createFailed'),
      );
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([
      refetchGroups(),
      refetchTopics(),
      refetchProjects(),
      loadMembers(),
    ]);
  };

  const errorBannerList = [
    groupsError,
    topicsError,
    membersError,
  ].filter(Boolean) as Array<Error | { message: string }>;

  const headerActions = (
    <>
      <Button
        variant="outline"
        size="md"
        className={styles.lecturerOutline}
        leftIcon={
          isLoadingGroups || isLoadingTopics || isLoadingMembers ? (
            <Loader size={14} className={styles.spinning} aria-hidden />
          ) : (
            <RefreshCw size={14} aria-hidden />
          )
        }
        onClick={() => void refreshAll()}
        disabled={isLoadingGroups || isLoadingTopics || isLoadingMembers}
      >
        {t('common.search')}
      </Button>
      <Button
        variant="primary"
        size="md"
        className={styles.lecturerPrimary}
        leftIcon={<Plus size={16} aria-hidden />}
        onClick={() => setShowCreateGroupModal(true)}
      >
        {t('lecturer.researchGroups.createBtn')}
      </Button>
    </>
  );

  return (
    <div className={styles.page} data-testid="lecturer-research-groups">
      <PageHeader
        eyebrow={t('lecturer.researchGroups.eyebrow')}
        title={t('lecturer.researchGroups.title')}
        description={
          <>
            {t('lecturer.researchGroups.descriptionStart')}
            <Link
              to={ROUTES.LECTURER_RESEARCH_TOPICS}
              className={styles.inlineLink}
            >
              {t('lecturer.researchGroups.topicsLink')}
            </Link>
            {t('lecturer.researchGroups.descriptionEnd')}
          </>
        }
        actions={headerActions}
        accent="var(--ars-lecturer)"
        titleAccessory={
          <span className={styles.headerMetaCount}>
            {groups.length} {groups.length === 1 ? t('lecturer.researchGroups.groupCount_one') : t('lecturer.researchGroups.groupCount_other')}
          </span>
        }
      />

      {banner.visible && (
        <div
          className={`${styles.successBanner} ${
            banner.variant === 'error' ? styles.errorBannerTop : ''
          }`}
          role="status"
        >
          <div className={styles.bannerLeft}>
            <span className={styles.bannerIcon}>
              {banner.variant === 'success' ? (
                <Check size={14} strokeWidth={3} aria-hidden />
              ) : (
                <AlertTriangle size={14} aria-hidden />
              )}
            </span>
            <div>
              <span className={styles.bannerTitle}>
                {banner.variant === 'success'
                  ? t('lecturer.researchGroups.actionSuccessful')
                  : t('lecturer.researchGroups.actionFailed')}
              </span>
              <p className={styles.bannerSub}>{banner.text}</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.bannerCloseBtn}
            onClick={() =>
              setBanner({ visible: false, text: '', variant: 'success' })
            }
            aria-label={t('common.cancel')}
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {errorBannerList.length > 0 && (
        <ErrorBanner
          tone="error"
          title={t('lecturer.researchGroups.failedToLoad')}
          message={
            errorBannerList
              .map((e) => ('message' in e ? e.message : String(e)))
              .join(' · ') || t('lecturer.researchGroups.pleaseRetry')
          }
          retry={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshAll()}
            >
              {t('common.retry')}
            </Button>
          }
        />
      )}

      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderLeft}>
          <Users size={18} className={styles.sectionIcon} aria-hidden />
          <h3 className={styles.sectionTitle}>{t('lecturer.researchGroups.activeGroups')}</h3>
          <span className={styles.countBadge}>
            {groupSearch.trim()
              ? `${groupTotalItems} / ${groups.length} ${t('lecturer.researchGroups.statGroups')}`
              : `${groups.length} ${t('lecturer.researchGroups.statGroups')}`}
          </span>
        </div>
      </div>

      <div className={styles.statStrip} aria-label="Research groups summary">
        <div className={styles.statCell}>
          <span className={styles.statLabel}>{t('lecturer.researchGroups.statGroups')}</span>
          <span className={styles.statValue}>{groups.length}</span>
          <span className={styles.statHint}>
            {groupSearch.trim() && groupTotalItems !== groups.length
              ? `${groupTotalItems} ${t('lecturer.researchGroups.statMatch')} "${groupSearch.trim()}"`
              : t('lecturer.researchGroups.statOwnedByYou')}
          </span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statLabel}>{t('lecturer.researchGroups.statTotalMembers')}</span>
          <span className={styles.statValue}>{members.length}</span>
          <span className={styles.statHint}>{t('lecturer.researchGroups.statAcrossGroups')}</span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statLabel}>{t('lecturer.researchGroups.statDue7Days')}</span>
          <span className={styles.statValue}>
            {groups.filter((g) => {
              if (!g.deadline) return false;
              const ms = new Date(g.deadline).getTime();
              const dayMs = 24 * 60 * 60 * 1000;
              return ms - Date.now() <= 7 * dayMs && ms >= Date.now();
            }).length}
          </span>
          <span className={styles.statHint}>{t('lecturer.researchGroups.statApproaching')}</span>
        </div>
      </div>

      <TableToolbar
        search={groupSearch}
        onSearchChange={setGroupSearch}
        onRefresh={handleRefreshGroups}
        isRefreshing={isRefreshingGroups}
        searchPlaceholder={t('lecturer.researchGroups.searchPlaceholder')}
        refreshLabel="Refresh"
      />

      {isLoadingGroups ? (
        <SkeletonRow count={4} withHeader />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title={t('lecturer.researchGroups.emptyTitle')}
          description={t('lecturer.researchGroups.emptyDesc')}
        />
      ) : groupTotalItems === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title={t('lecturer.researchGroups.noMatchTitle')}
          description={`${t('lecturer.researchGroups.noMatchDesc')} "${groupSearch.trim()}".`}
        />
      ) : (
        <div className={styles.grid}>
          {pagedGroups.map((grp) => {
            const gid = typeof grp.id === 'number' ? grp.id : -1;
            const idLabel = gid >= 0 ? formatGroupId(gid) : '—';
            const topic = grp.topicId ? topicById.get(grp.topicId) : null;
            const status = deriveGroupStatus(grp, topic?.status ?? null);
            const deadlineLabel = grp.deadline
              ? formatDisplayDate(grp.deadline, locale)
              : '';
            const roster = gid >= 0 ? memberIndex[gid] ?? [] : [];
            return (
              <article className={styles.groupCard} key={gid}>
                <div className={styles.cardTopRow}>
                  <div className={styles.metaPills}>
                    <span className={styles.idPill}>{idLabel}</span>
                    <StatusBadge status={status} />
                  </div>
                </div>

                <h4 className={styles.groupTitle}>
                  {grp.name ?? t('lecturer.researchGroups.untitledGroup')}
                </h4>

                <div className={styles.topicRow}>
                  <Lightbulb size={12} aria-hidden />
                  <span>{t('lecturer.researchGroups.topicLabel')}</span>
                  {topic ? (
                    <Link
                      to={ROUTES.LECTURER_RESEARCH_TOPICS}
                      className={styles.topicLink}
                      data-testid="assigned-topic-link"
                    >
                      {topic.title ?? `RT-${grp.topicId}`}
                      <ArrowRight size={10} aria-hidden />
                    </Link>
                  ) : (
                    <span className={styles.topicUnassigned}>{t('lecturer.researchGroups.unassigned')}</span>
                  )}
                </div>
                <p className={styles.desc}>
                  {grp.description?.trim() || t('lecturer.researchGroups.noDescription')}
                </p>

                <div
                  className={styles.cardMetaStrip}
                  aria-label="Group quick facts"
                >
                  <span title={t('lecturer.researchGroups.membersLabel')}>
                    <Users size={12} aria-hidden />
                    {roster.length} {roster.length === 1 ? t('lecturer.researchGroups.memberCount_one') : t('lecturer.researchGroups.memberCount_other')}
                  </span>
                  <span
                    data-tone={deadlineTone(deadlineLabel)}
                    title="Next deadline"
                  >
                    <Calendar size={12} aria-hidden />
                    {deadlineLabel
                      ? `${t('lecturer.researchGroups.due')} ${deadlineLabel}`
                      : t('lecturer.researchGroups.noDeadline')}
                  </span>
                  <span title="Topic assignment">
                    <Lightbulb size={12} aria-hidden />
                    {topic ? t('lecturer.researchGroups.assignedTopic') : t('lecturer.researchGroups.noTopicYet')}
                  </span>
                </div>

                <div className={styles.membersSection}>
                  <span className={styles.membersLabel}>
                    {t('lecturer.researchGroups.membersLabel')} ({roster.length})
                  </span>
                  <div className={styles.memberPills}>
                    {isLoadingMembers && roster.length === 0 ? (
                      <span className={styles.memberPill}>{t('common.loading')}</span>
                    ) : roster.length === 0 ? (
                      <span className={styles.memberPill}>{t('lecturer.researchGroups.noMembersYet')}</span>
                    ) : (
                      roster.map((m, idx) => {
                        const label = m.studentId
                          ? `${t('lecturer.researchGroups.studentId')}${m.studentId}`
                          : `${t('lecturer.researchGroups.memberId')}${m.id ?? idx}`;
                        const isLeader = Boolean(m.isLeader);
                        return (
                          <span
                            key={String(m.id ?? idx)}
                            className={`${styles.memberPill} ${isLeader ? styles.memberPillLeader : ''}`}
                            data-testid={isLeader ? 'group-leader-pill' : undefined}
                          >
                            {isLeader && (
                              <span
                                className={styles.leaderGlyph}
                                aria-label={t('lecturer.researchGroups.selectedLeader')}
                                title={t('lecturer.researchGroups.selectedLeader')}
                              >
                                <Crown size={10} aria-hidden />
                              </span>
                            )}
                            <span
                              className={styles.memberAvatar}
                              data-avatar-tone={avatarToneAt(idx)}
                            >
                              {initialsOf(label)}
                            </span>
                            {label}
                            {m.activityStatus && (
                              <span className={styles.activityTag}>
                                · {m.activityStatus}
                              </span>
                            )}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.iconBtnGroup}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={t('lecturer.researchGroups.deleteGroup')}
                      aria-label={t('lecturer.researchGroups.deleteGroup')}
                      onClick={() =>
                        handleDeleteGroup(gid, grp.name ?? idLabel)
                      }
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                  <Link
                    to={
                      typeof grp.id === 'number'
                        ? ROUTES.LECTURER_GROUP_DETAIL.replace(
                            ':groupId',
                            String(grp.id),
                          )
                        : ROUTES.RESEARCH_GROUP
                    }
                    className={styles.viewBtn}
                    title="Open this group's detail page"
                  >
                    <Users size={14} aria-hidden />
                    {t('lecturer.researchGroups.viewGroup')}
                  </Link>
                </div>
              </article>
            );
          })}

          <button
            type="button"
            className={styles.dashedCreateCard}
            onClick={() => setShowCreateGroupModal(true)}
            aria-label={t('lecturer.researchGroups.createNewGroup')}
          >
            <Plus size={32} className={styles.plusIconLarge} aria-hidden />
            <span className={styles.dashedCreateText}>{t('lecturer.researchGroups.createNewGroup')}</span>
          </button>
        </div>
      )}

      {groupTotalPages > 1 && (
        <TablePagination
          page={groupPage}
          totalPages={groupTotalPages}
          totalItems={groupTotalItems}
          startIndex={groupStartIndex}
          endIndex={groupEndIndex}
          onPrev={prevGroupPage}
          onNext={nextGroupPage}
          onPage={setGroupPage}
          itemLabel="groups"
        />
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateGroupModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <Users size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>{t('lecturer.researchGroups.createModalTitle')}</h3>
                  <span className={styles.modalSubtitle}>
                    {t('lecturer.researchGroups.createModalSub')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowCreateGroupModal(false)}
                aria-label={t('common.cancel')}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <form
              onSubmit={handleCreateGroupSubmit}
              className={styles.modalBody}
            >
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="groupName">
                  {t('lecturer.researchGroups.groupNameLabel')}
                </label>
                <input
                  id="groupName"
                  type="text"
                  className={`${styles.formInput} ${
                    groupNameError ? styles.formInputError : ''
                  }`}
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    if (groupNameError) setGroupNameError(null);
                  }}
                  placeholder={t('lecturer.researchGroups.groupNamePlaceholder')}
                  aria-invalid={Boolean(groupNameError)}
                  aria-describedby={
                    groupNameError ? 'group-name-error' : undefined
                  }
                  required
                />
                <FieldError
                  id="group-name-error"
                  message={groupNameError}
                  testId="rg-group-name-error"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="groupDesc">
                  {t('lecturer.researchGroups.descLabel')}
                </label>
                <textarea
                  id="groupDesc"
                  className={styles.formTextarea}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder={t('lecturer.researchGroups.descPlaceholder')}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="groupDeadline">
                  {t('lecturer.researchGroups.deadlineLabel')}
                </label>
                <input
                  id="groupDeadline"
                  type="date"
                  className={`${styles.formInput} ${
                    groupDeadlineError ? styles.formInputError : ''
                  }`}
                  value={groupDeadline}
                  onChange={(e) => {
                    setGroupDeadline(e.target.value);
                    if (groupDeadlineError) setGroupDeadlineError(null);
                  }}
                  aria-invalid={Boolean(groupDeadlineError)}
                  aria-describedby={
                    groupDeadlineError
                      ? 'group-deadline-error'
                      : 'group-deadline-helper'
                  }
                />
                <span className={styles.helperText} id="group-deadline-helper">
                  {t('lecturer.researchGroups.deadlineHelper')}
                </span>
                <FieldError
                  id="group-deadline-error"
                  message={groupDeadlineError}
                  testId="rg-group-deadline-error"
                />
              </div>

              {createGroupError && (
                <div className={styles.errorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{createGroupError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowCreateGroupModal(false)}
                  disabled={isCreatingGroup}
                >
                  {t('lecturer.researchGroups.cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  className={styles.lecturerPrimary}
                  leftIcon={
                    isCreatingGroup ? (
                      <Loader size={14} className={styles.spinning} aria-hidden />
                    ) : (
                      <Check size={14} aria-hidden />
                    )
                  }
                  disabled={isCreatingGroup}
                >
                  {isCreatingGroup ? t('lecturer.researchGroups.creatingBtn') : t('lecturer.researchGroups.createBtn')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchGroup;
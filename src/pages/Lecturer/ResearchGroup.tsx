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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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

export const ResearchGroup = () => {
  const { user } = useAuth();
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
        err instanceof Error ? err.message : 'Failed to load group members.',
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

  const showBanner = (
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
    const ok = window.confirm(`Delete "${name}"? This action cannot be undone.`);
    if (!ok) return;
    try {
      await researchGroupService.delete(groupId);
      showBanner(`Research Group "${name}" deleted.`);
      await refetchGroups();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete the group.';
      showBanner(`Delete failed: ${message}`, 'error');
    }
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecturerId) {
      setCreateGroupError('No lecturer session — please sign in again.');
      return;
    }
    const trimmedName = groupName.trim();
    const nameErr = trimmedName ? null : 'Group name is required.';
    let deadlineErr: string | null = null;
    if (groupDeadline) {
      const ms = new Date(groupDeadline).getTime();
      if (Number.isNaN(ms)) deadlineErr = 'Deadline is not a valid date.';
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
        deadline: groupDeadline ? new Date(groupDeadline).toISOString() : null,
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
      showBanner(
        `Research Group ${idLabel} ("${created.name ?? groupName}") created successfully.`,
      );
      await refetchGroups();
    } catch (err) {
      setCreateGroupError(
        err instanceof Error ? err.message : 'Failed to create the group.',
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
        Refresh
      </Button>
      <Button
        variant="primary"
        size="md"
        className={styles.lecturerPrimary}
        leftIcon={<Plus size={16} aria-hidden />}
        onClick={() => setShowCreateGroupModal(true)}
      >
        Create Research Group
      </Button>
    </>
  );

  return (
    <div className={styles.page} data-testid="lecturer-research-groups">
      <PageHeader
        eyebrow="LECTURER WORKSPACE"
        title="Research Groups"
        description={
          <>
            Manage active research groups and the topics assigned to them.
            Topics themselves live on the{' '}
            <Link
              to={ROUTES.LECTURER_RESEARCH_TOPICS}
              className={styles.inlineLink}
            >
              Research Topics
            </Link>{' '}
            page.
          </>
        }
        actions={headerActions}
        accent="var(--ars-lecturer)"
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
                  ? 'Action Successful'
                  : 'Action Failed'}
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
            aria-label="Dismiss"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {errorBannerList.length > 0 && (
        <ErrorBanner
          tone="error"
          title="Failed to load data"
          message={
            errorBannerList
              .map((e) => ('message' in e ? e.message : String(e)))
              .join(' · ') || 'Please retry.'
          }
          retry={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshAll()}
            >
              Retry
            </Button>
          }
        />
      )}

      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderLeft}>
          <Users size={18} className={styles.sectionIcon} aria-hidden />
          <h3 className={styles.sectionTitle}>Active Research Groups</h3>
          <span className={styles.countBadge}>
            {groupSearch.trim()
              ? `${groupTotalItems} / ${groups.length} Groups`
              : `${groups.length} Groups`}
          </span>
        </div>
      </div>

      <TableToolbar
        search={groupSearch}
        onSearchChange={setGroupSearch}
        onRefresh={handleRefreshGroups}
        isRefreshing={isRefreshingGroups}
        searchPlaceholder="Search groups by name, description, or assigned topic"
        refreshLabel="Refresh"
      />

      {isLoadingGroups ? (
        <SkeletonRow count={4} withHeader />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title="No research groups yet"
          description='Click "Create Research Group" to start a new one.'
        />
      ) : groupTotalItems === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title="No matches"
          description={`No groups match "${groupSearch.trim()}".`}
        />
      ) : (
        <div className={styles.grid}>
          {pagedGroups.map((grp) => {
            const gid = typeof grp.id === 'number' ? grp.id : -1;
            const idLabel = gid >= 0 ? formatGroupId(gid) : '—';
            const topic = grp.topicId ? topicById.get(grp.topicId) : null;
            const status = deriveGroupStatus(grp, topic?.status ?? null);
            const deadlineLabel = grp.deadline
              ? new Date(grp.deadline).toISOString().split('T')[0]
              : '';
            const roster = gid >= 0 ? memberIndex[gid] ?? [] : [];
            return (
              <article className={styles.groupCard} key={gid}>
                <div className={styles.cardTopRow}>
                  <div className={styles.metaPills}>
                    <span className={styles.idPill}>{idLabel}</span>
                    <StatusBadge status={status} />
                  </div>
                  {deadlineLabel && (
                    <span className={styles.deadlinePill}>
                      Due {deadlineLabel}
                    </span>
                  )}
                </div>

                <h4 className={styles.groupTitle}>
                  {grp.name ?? '(untitled group)'}
                </h4>

                <div className={styles.topicRow}>
                  <Lightbulb size={12} aria-hidden />
                  Topic:{' '}
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
                    <span className={styles.topicUnassigned}>Unassigned</span>
                  )}
                </div>
                <p className={styles.desc}>
                  {grp.description?.trim() ||
                    'No description provided for this group yet.'}
                </p>

                <div className={styles.membersSection}>
                  <span className={styles.membersLabel}>
                    Members ({roster.length})
                  </span>
                  <div className={styles.memberPills}>
                    {isLoadingMembers && roster.length === 0 ? (
                      <span className={styles.memberPill}>Loading…</span>
                    ) : roster.length === 0 ? (
                      <span className={styles.memberPill}>No members yet</span>
                    ) : (
                      roster.map((m, idx) => {
                        const label = m.studentId
                          ? `student #${m.studentId}`
                          : `member #${m.id ?? idx}`;
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
                                aria-label="Selected group leader"
                                title="Selected group leader"
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
                      title="Delete group"
                      aria-label="Delete group"
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
                    View Group
                  </Link>
                </div>
              </article>
            );
          })}

          <button
            type="button"
            className={styles.dashedCreateCard}
            onClick={() => setShowCreateGroupModal(true)}
            aria-label="Create new group"
          >
            <Plus size={32} className={styles.plusIconLarge} aria-hidden />
            <span className={styles.dashedCreateText}>Create New Group</span>
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
                  <h3 className={styles.modalTitle}>Create New Research Group</h3>
                  <span className={styles.modalSubtitle}>
                    Fill in the details below to create a new group.
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowCreateGroupModal(false)}
                aria-label="Close"
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
                  Research Group Name
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
                  placeholder="AI Speech-to-Text Research Team"
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
                  Description
                </label>
                <textarea
                  id="groupDesc"
                  className={styles.formTextarea}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Investigating Whisper AI model accuracy across regional dialects."
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="groupDeadline">
                  Deadline (optional)
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
                  ISO timestamp is sent to the BE. Leave blank if not yet
                  decided.
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
                  Cancel
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
                  {isCreatingGroup ? 'Creating…' : 'Create Research Group'}
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
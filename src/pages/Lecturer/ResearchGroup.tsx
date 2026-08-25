// Lecturer — Research Groups (groups-only)
//
// Per the Coordinator brief, this page is now groups-only. The Topics CRUD
// was moved to a dedicated top-level page (`src/pages/Lecturer/ResearchTopics.tsx`)
// reachable from the sidebar. This page keeps the assigned-topic summary
// on every group card and links to the topic's row on the new page so the
// lecturer can navigate Groups → Topic without a back/forward dance.
//
// All data is fetched from the live API. No mock records. No hardcoded
// "Topic 1" data. Active strict-DTO call-site widening is preserved
// (see researchWorkflowDtos.ts and the strict-DTO services for context).

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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import { useResearchTopics } from '../../hooks/useResearchTopics';
import { useGuidanceProjects } from '../../hooks/useGuidanceProjects';
import { researchGroupService, deriveGroupStatus } from '../../services/researchGroup.service';
import type { ResearchTopic } from '../../types/research';
import { groupMemberService, indexGroupMembersByGroupId } from '../../services/groupMember.service';
import type { GroupMember } from '../../services/groupMember.service';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { FieldError } from '../../components/FieldError';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { usePagination } from '../../hooks/usePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
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

const avatarColors = ['#10b981', '#f59e0b', '#3b82f6', '#7c3aed', '#ef4444'];

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
          new Date(b.assignedAt ?? 0).getTime() - new Date(a.assignedAt ?? 0).getTime(),
      ),
    [groups],
  );

  // Topics are now only read for the per-group "Assigned topic" summary
  // pill. No mutation happens on this page anymore — see
  // `ResearchTopics.tsx` for the canonical CRUD surface.
  const {
    topics,
    isLoading: isLoadingTopics,
    error: topicsError,
    refetch: refetchTopics,
  } = useResearchTopics();

  const { refetch: refetchProjects } = useGuidanceProjects();

  // Members are loaded separately (no server-side filter — see groupMember.service.ts).
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

  // ── Modal state ────────────────────────────────────────────────────────
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  // (AssignTopicModal was removed — assignment is no longer wired on this
  // page. The canonical "assign topic to group" flow now belongs to the
  // dedicated Research Topics page once BE ships an assignment endpoint.)

  // ── Banner state ────────────────────────────────────────────────────────
  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    text: '',
    variant: 'success',
  });

  // ── Create Group form state ────────────────────────────────────────────
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupDeadline, setGroupDeadline] = useState('');
  const [groupNameError, setGroupNameError] = useState<string | null>(null);
  const [groupDeadlineError, setGroupDeadlineError] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  // ── Toolbar: search + refresh state for the groups grid ──────────────────
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
    const ok = window.confirm(
      `Delete "${name}"? This action cannot be undone.`,
    );
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
      const idLabel = typeof created.id === 'number' ? formatGroupId(created.id) : '';
      showBanner(`Research Group ${idLabel} ("${created.name ?? groupName}") created successfully.`);
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
    await Promise.all([refetchGroups(), refetchTopics(), refetchProjects(), loadMembers()]);
  };

  return (
    <div className={styles.researchGroupPage} data-testid="lecturer-research-groups">
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <Link to={ROUTES.FORUM}>Forums</Link> &gt;{' '}
        <span className={styles.activeBreadcrumb}>Research Groups</span>
      </div>

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Research Groups</h1>
          <p className={styles.pageSubtitle}>
            Manage active research groups and the topics assigned to them.
            Topics themselves live on the{' '}
            <Link
              to={ROUTES.LECTURER_RESEARCH_TOPICS}
              className={styles.activeBreadcrumb}
            >
              Research Topics
            </Link>{' '}
            page.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={styles.createGroupBtn}
            onClick={() => void refreshAll()}
            disabled={isLoadingGroups || isLoadingTopics || isLoadingMembers}
            aria-label="Refresh"
          >
            <RefreshCw size={14} aria-hidden />
            Refresh
          </button>
          <button
            type="button"
            className={styles.createGroupBtn}
            onClick={() => setShowCreateGroupModal(true)}
          >
            <Plus size={16} aria-hidden />
            Create Research Group
          </button>
        </div>
      </div>

      {/* BANNER */}
      {banner.visible && (
        <div className={styles.successToastBanner}>
          <div className={styles.toastLeft}>
            <span className={styles.toastCheckIcon}>
              {banner.variant === 'success' ? (
                <Check size={14} strokeWidth={3} aria-hidden />
              ) : (
                <AlertTriangle size={14} aria-hidden />
              )}
            </span>
            <div>
              <span className={styles.toastTitle}>
                {banner.variant === 'success' ? 'Action Successful' : 'Action Failed'}
              </span>
              <p className={styles.toastSub}>{banner.text}</p>
            </div>
          </div>
          <div className={styles.toastRight}>
            <button
              type="button"
              className={styles.toastCloseBtn}
              onClick={() =>
                setBanner({ visible: false, text: '', variant: 'success' })
              }
              aria-label="Dismiss"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL ERROR BANNER (any list failed to load) */}
      {(groupsError || topicsError || membersError) && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.errorBannerIcon}>
            <AlertTriangle size={14} aria-hidden />
            <span>
              {groupsError?.message ?? topicsError?.message ?? membersError ?? 'Failed to load data. Please retry.'}
            </span>
          </span>
          <button
            type="button"
            className={styles.errorRetryBtn}
            onClick={() => void refreshAll()}
          >
            Retry
          </button>
        </div>
      )}

      {/* SECTION 1: Active Research Groups */}
      <div className={styles.sectionHeaderRow}>
        <div className={styles.sectionTitleBlock}>
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

      {/* Groups Grid */}
      <div className={styles.groupsGrid}>
        {isLoadingGroups ? (
          <div className={styles.loadingCard}>
            <Loader size={20} className={styles.spinningIcon} aria-hidden />
            <span>Loading research groups…</span>
          </div>
        ) : groups.length === 0 ? (
          <div className={styles.emptyCard}>
            <Inbox size={28} className={styles.emptyIcon} aria-hidden />
            <h4 className={styles.emptyTitle}>No research groups yet</h4>
            <p className={styles.emptyText}>
              Click "Create Research Group" to start a new one.
            </p>
          </div>
        ) : groupTotalItems === 0 ? (
          <div className={styles.emptyCard}>
            <Inbox size={28} className={styles.emptyIcon} aria-hidden />
            <h4 className={styles.emptyTitle}>No matches</h4>
            <p className={styles.emptyText}>
              No groups match "{groupSearch.trim()}".
            </p>
          </div>
        ) : (
          pagedGroups.map((grp) => {
            const gid = typeof grp.id === 'number' ? grp.id : -1;
            const idLabel = gid >= 0 ? formatGroupId(gid) : '—';
            const topic = grp.topicId ? topicById.get(grp.topicId) : null;
            const status = deriveGroupStatus(grp, topic?.status ?? null);
            const deadlineLabel = grp.deadline
              ? new Date(grp.deadline).toISOString().split('T')[0]
              : '';
            const roster = gid >= 0 ? memberIndex[gid] ?? [] : [];
            return (
              <div className={styles.groupCard} key={gid}>
                {/* Header badges */}
                <div className={styles.cardTopRow}>
                  <div className={styles.leftPills}>
                    <span className={styles.groupIdPill}>{idLabel}</span>
                    <StatusBadge status={status} />
                  </div>
                  {deadlineLabel && (
                    <span className={styles.dueDatePill}>
                      Deadline: {deadlineLabel}
                    </span>
                  )}
                </div>

                <h4 className={styles.groupCardTitle}>{grp.name ?? '(untitled group)'}</h4>

                {/* Assigned-topic summary — read-only link to the canonical
                    Research Topics page. The CRUD lives on the new page;
                    this row is the entry point for "what topic is this
                    group working on?" */}
                <div className={styles.groupTopicText}>
                  <Lightbulb
                    size={12}
                    aria-hidden
                    style={{ marginRight: 4 }}
                  />
                  Topic:{' '}
                  {topic ? (
                    <Link
                      to={ROUTES.LECTURER_RESEARCH_TOPICS}
                      className={styles.activeBreadcrumb}
                      data-testid="assigned-topic-link"
                    >
                      {topic.title ?? `RT-${grp.topicId}`}
                      <ArrowRight size={10} aria-hidden style={{ marginLeft: 2 }} />
                    </Link>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Unassigned</span>
                  )}
                </div>
                <p className={styles.groupDescText}>
                  {grp.description?.trim() ||
                    'No description provided for this group yet.'}
                </p>

                {/* Roster Members */}
                <div className={styles.membersSection}>
                  <span className={styles.membersLabel}>
                    MEMBERS ({roster.length})
                  </span>
                  <div className={styles.memberPillsRow}>
                    {isLoadingMembers && roster.length === 0 ? (
                      <span className={styles.memberPillTag}>Loading…</span>
                    ) : roster.length === 0 ? (
                      <span className={styles.memberPillTag}>No members yet</span>
                    ) : (
                      roster.map((m, idx) => {
                        const label = m.studentId ? `student #${m.studentId}` : `member #${m.id ?? idx}`;
                        return (
                          <span key={String(m.id ?? idx)} className={styles.memberPillTag}>
                            <span
                              className={styles.memberAvatarIcon}
                              style={{
                                backgroundColor:
                                  avatarColors[idx % avatarColors.length] ?? '#94a3b8',
                              }}
                            >
                              {initialsOf(label)}
                            </span>
                            {label}
                            {m.activityStatus && (
                              <span className={styles.activityTag}>
                                {' '}
                                · {m.activityStatus}
                              </span>
                            )}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className={styles.groupCardFooter}>
                  <div className={styles.iconButtonsLeft}>
                    <button
                      type="button"
                      className={styles.actionIconBtn}
                      title="Delete group"
                      aria-label="Delete group"
                      onClick={() => handleDeleteGroup(gid, grp.name ?? idLabel)}
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
                    className={styles.viewGroupNavyBtn}
                    title="Open this group's detail page"
                  >
                    <Users size={14} aria-hidden />
                    View Group
                  </Link>
                </div>
              </div>
            );
          })
        )}

        {/* Create New Group Card */}
        <div
          className={styles.createGroupDashedCard}
          onClick={() => setShowCreateGroupModal(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowCreateGroupModal(true);
            }
          }}
        >
          <Plus size={32} className={styles.plusIconLarge} aria-hidden />
          <span className={styles.createDashedText}>Create New Group</span>
        </div>
      </div>

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
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <Users size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Create New Research Group</h3>
                  <span className={styles.modalSubtitle}>
                    Fill in the details below to create a new group
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

            <form onSubmit={handleCreateGroupSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="groupName">
                  * Research Group Name
                </label>
<input
              id="groupName"
              type="text"
              className={`${styles.formInput} ${groupNameError ? styles.formInputError : ''}`}
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                if (groupNameError) setGroupNameError(null);
              }}
              placeholder="AI Speech-to-Text Research Team"
              aria-invalid={Boolean(groupNameError)}
              aria-describedby={groupNameError ? 'group-name-error' : undefined}
              required
            />
            <FieldError id="group-name-error" message={groupNameError} testId="rg-group-name-error" />
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
              className={`${styles.formInput} ${groupDeadlineError ? styles.formInputError : ''}`}
              value={groupDeadline}
              onChange={(e) => {
                setGroupDeadline(e.target.value);
                if (groupDeadlineError) setGroupDeadlineError(null);
              }}
              aria-invalid={Boolean(groupDeadlineError)}
              aria-describedby={groupDeadlineError ? 'group-deadline-error' : 'group-deadline-helper'}
            />
            <span className={styles.helperText} id="group-deadline-helper">
              ISO timestamp is sent to the BE. Leave blank if not yet decided.
            </span>
            <FieldError id="group-deadline-error" message={groupDeadlineError} testId="rg-group-deadline-error" />
          </div>

              {createGroupError && (
                <div className={styles.errorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{createGroupError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowCreateGroupModal(false)}
                  disabled={isCreatingGroup}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitNavyBtn}
                  disabled={isCreatingGroup}
                >
                  {isCreatingGroup ? (
                    <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  ) : (
                    <Check size={14} aria-hidden />
                  )}
                  {isCreatingGroup ? 'Creating…' : 'Create Research Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign-topic modal removed — assignment is no longer triggered
          from the Research Groups page. See the module-level comment for
          the canonical CRUD location. */}
    </div>
  );
};

export default ResearchGroup;
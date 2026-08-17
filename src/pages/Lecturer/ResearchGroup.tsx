import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Check,
  X,
  Users,
  Pencil,
  Trash2,
  BookOpen,
  Settings,
  Lightbulb,
  FileText,
  Loader,
  AlertTriangle,
  RefreshCw,
  Inbox,
  ToggleRight,
  ToggleLeft,
  CheckCircle2,
  Library,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import { useResearchTopics } from '../../hooks/useResearchTopics';
import { useGuidanceProjects } from '../../hooks/useGuidanceProjects';
import { researchGroupService, deriveGroupStatus } from '../../services/researchGroup.service';
import { researchTopicService, type ResearchTopic } from '../../services/researchTopic.service';
import { canTransitionResearchTopic } from '../../utils/researchStatus';
import type { ResearchTopicStatus } from '../../types/research';
import { groupMemberService, indexGroupMembersByGroupId } from '../../services/groupMember.service';
import type { GroupMember } from '../../services/groupMember.service';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { AssignTopicModal } from '../../components/lecturer/AssignTopicModal';
import { LearningMaterialModal } from '../../components/lecturer/LearningMaterialModal';
import { ROUTES } from '../../routes/paths';
import styles from './ResearchGroup.module.css';

interface BannerState {
  visible: boolean;
  text: string;
}

const formatGroupId = (id: number): string =>
  `RG-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`;
const formatTopicId = (id: number): string =>
  `RT-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`;

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
  const [showCreateTopicModal, setShowCreateTopicModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [topicForAssign, setTopicForAssign] = useState<ResearchTopic | null>(null);
  // Edit topic modal (L3.a)
  const [topicForEdit, setTopicForEdit] = useState<ResearchTopic | null>(null);
  // Manage materials modal (L3.c)
  const [topicForMaterials, setTopicForMaterials] = useState<ResearchTopic | null>(
    null,
  );

  // ── Banner state ────────────────────────────────────────────────────────
  const [banner, setBanner] = useState<BannerState>({ visible: false, text: '' });

  // ── Create Group form state ────────────────────────────────────────────
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupDeadline, setGroupDeadline] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  // ── Create Topic form state ────────────────────────────────────────────
  const [topicName, setTopicName] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [topicMaterialsUrl, setTopicMaterialsUrl] = useState('');
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [createTopicError, setCreateTopicError] = useState<string | null>(null);

  // ── Edit Topic form state (L3.a) ─────────────────────────────────────
  const [editTopicTitle, setEditTopicTitle] = useState('');
  const [editTopicDesc, setEditTopicDesc] = useState('');
  const [editTopicMaterialsUrl, setEditTopicMaterialsUrl] = useState('');
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [editTopicError, setEditTopicError] = useState<string | null>(null);

  // Per-row status-transition inflight (L3.a open/close/complete).
  const [topicTransition, setTopicTransition] = useState<{
    id: number;
    to: ResearchTopicStatus;
  } | null>(null);

  const showBanner = (text: string) => {
    setBanner({ visible: true, text });
    // Auto-dismiss after 4s (matches existing SeminarWorkspace behaviour).
    window.setTimeout(() => setBanner({ visible: false, text: '' }), 4000);
  };

  const handleOpenAssignModal = (topic: ResearchTopic) => {
    setTopicForAssign(topic);
    setShowAssignModal(true);
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
      showBanner(`Delete failed: ${message}`);
    }
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecturerId) {
      setCreateGroupError('No lecturer session — please sign in again.');
      return;
    }
    if (!groupName.trim()) {
      setCreateGroupError('Group name is required.');
      return;
    }
    setIsCreatingGroup(true);
    setCreateGroupError(null);
    try {
      const created = await researchGroupService.create({
        lecturerId,
        name: groupName.trim(),
        description: groupDesc.trim() || null,
        deadline: groupDeadline ? new Date(groupDeadline).toISOString() : null,
        assignedAt: null,
      });
      setShowCreateGroupModal(false);
      setGroupName('');
      setGroupDesc('');
      setGroupDeadline('');
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

  const handleCreateTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicName.trim()) {
      setCreateTopicError('Topic name is required.');
      return;
    }
    setIsCreatingTopic(true);
    setCreateTopicError(null);
    try {
      const created = await researchTopicService.create({
        title: topicName.trim(),
        description: topicDesc.trim() || null,
        materialsUrl: topicMaterialsUrl.trim() || null,
        status: 'OPEN',
      });
      setShowCreateTopicModal(false);
      setTopicName('');
      setTopicDesc('');
      setTopicMaterialsUrl('');
      const idLabel = typeof created.id === 'number' ? formatTopicId(created.id) : '';
      showBanner(`Research Topic ${idLabel} ("${created.title ?? topicName}") created successfully.`);
      await refetchTopics();
    } catch (err) {
      setCreateTopicError(
        err instanceof Error ? err.message : 'Failed to create the topic.',
      );
    } finally {
      setIsCreatingTopic(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([refetchGroups(), refetchTopics(), refetchProjects(), loadMembers()]);
  };

  // Open the edit-topic modal and seed its form with the current row.
  const handleOpenEditTopic = (topic: ResearchTopic) => {
    setTopicForEdit(topic);
    setEditTopicTitle(typeof topic.title === 'string' ? topic.title : '');
    setEditTopicDesc(typeof topic.description === 'string' ? topic.description : '');
    setEditTopicMaterialsUrl(
      typeof topic.materialsUrl === 'string' ? topic.materialsUrl : '',
    );
    setEditTopicError(null);
  };

  const handleCloseEditTopic = () => {
    if (isEditingTopic) return;
    setTopicForEdit(null);
  };

  const handleEditTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicForEdit || typeof topicForEdit.id !== 'number') {
      setEditTopicError('Topic has no id; cannot be saved.');
      return;
    }
    const title = editTopicTitle.trim();
    if (!title) {
      setEditTopicError('Title is required.');
      return;
    }
    setIsEditingTopic(true);
    setEditTopicError(null);
    try {
      await researchTopicService.update(topicForEdit.id, {
        title,
        description: editTopicDesc.trim() || null,
        materialsUrl: editTopicMaterialsUrl.trim() || null,
      });
      setTopicForEdit(null);
      showBanner(`Research Topic RT-${formatTopicId(topicForEdit.id).slice(3)} ("${title}") updated successfully.`);
      await refetchTopics();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Server rejected the topic update.';
      setEditTopicError(message);
    } finally {
      setIsEditingTopic(false);
    }
  };

  // L3.a — Open/Close/Mark Completed transitions, all gated by
  // `canTransitionResearchTopic`.
  const handleTopicTransition = async (
    topic: ResearchTopic,
    to: ResearchTopicStatus,
  ) => {
    if (typeof topic.id !== 'number') return;
    const fromStatus = (topic.status ?? 'OPEN') as ResearchTopicStatus;
    if (!canTransitionResearchTopic(fromStatus, to)) {
      showBanner(
        `Cannot transition this topic from ${fromStatus} to ${to} — not allowed by the workflow contract.`,
      );
      return;
    }
    setTopicTransition({ id: topic.id, to });
    try {
      await researchTopicService.update(topic.id, { status: to });
      showBanner(
        `Topic "${topic.title ?? `RT-${topic.id}`}" marked as ${to}.`,
      );
      await refetchTopics();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'The transition was rejected by the server.';
      showBanner(`Transition failed: ${message}`);
    } finally {
      setTopicTransition(null);
    }
  };

  // L3.c — opens the per-topic materials manager.
  const handleOpenMaterials = (topic: ResearchTopic) => {
    setTopicForMaterials(topic);
  };

  const handleCloseMaterials = () => {
    setTopicForMaterials(null);
  };

  return (
    <div className={styles.researchGroupPage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Research Management</span>
      </div>

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Research Groups &amp; Topics Management</h1>
          <p className={styles.pageSubtitle}>
            Manage active research groups, assign topics, and track member progress.
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

      {/* SUCCESS TOAST BANNER */}
      {banner.visible && (
        <div className={styles.successToastBanner}>
          <div className={styles.toastLeft}>
            <span className={styles.toastCheckIcon}>
              <Check size={14} strokeWidth={3} aria-hidden />
            </span>
            <div>
              <span className={styles.toastTitle}>Action Successful</span>
              <p className={styles.toastSub}>{banner.text}</p>
            </div>
          </div>
          <div className={styles.toastRight}>
            <button
              type="button"
              className={styles.toastCloseBtn}
              onClick={() => setBanner({ visible: false, text: '' })}
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
          <span className={styles.countBadge}>{groups.length} Groups</span>
        </div>
      </div>

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
        ) : (
          groups.map((grp) => {
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
                <div className={styles.groupTopicText}>
                  Topic: {topic ? topic.title ?? `RT-${grp.topicId}` : 'Unassigned'}
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
                      title="Edit group (coming soon)"
                      aria-label="Edit group"
                      disabled
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
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

      {/* SECTION 2: Research Topics Library */}
      <div className={styles.sectionHeaderRow} style={{ marginTop: '24px' }}>
        <div className={styles.sectionTitleBlock}>
          <BookOpen size={18} className={styles.sectionIcon} aria-hidden />
          <h3 className={styles.sectionTitle}>Research Topics Library</h3>
          <span className={styles.countBadge}>{topics.length} Topics</span>
        </div>
        <button
          type="button"
          className={styles.createTopicOutlineBtn}
          onClick={() => setShowCreateTopicModal(true)}
        >
          <Plus size={14} aria-hidden />
          Create Research Topic
        </button>
      </div>

      {/* Topics Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TOPIC ID &amp; NAME</th>
                <th>DESCRIPTION</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingTopics ? (
                <tr>
                  <td colSpan={4} className={styles.tableEmpty}>
                    <Loader size={16} className={styles.spinningIcon} aria-hidden />
                    Loading topics…
                  </td>
                </tr>
              ) : topics.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.tableEmpty}>
                    No topics yet. Click "Create Research Topic" to add one.
                  </td>
                </tr>
              ) : (
                topics.map((topic) => {
                  const tid = typeof topic.id === 'number' ? topic.id : -1;
                  const idLabel = tid >= 0 ? formatTopicId(tid) : '—';
                  const topicStatus =
                    (topic.status ?? 'OPEN') as ResearchTopicStatus;
                  const canOpen = canTransitionResearchTopic(
                    topicStatus,
                    'OPEN',
                  );
                  const canClose = canTransitionResearchTopic(
                    topicStatus,
                    'CLOSED',
                  );
                  const canComplete = canTransitionResearchTopic(
                    topicStatus,
                    'COMPLETED',
                  );
                  const inflight =
                    topicTransition && topicTransition.id === tid
                      ? topicTransition.to
                      : null;
                  return (
                    <tr key={tid}>
                      <td>
                        <span className={styles.topicIdBadge}>{idLabel}</span>
                        <span className={styles.topicNameText}>
                          {topic.title ?? '(untitled topic)'}
                        </span>
                      </td>
                      <td className={styles.topicDescText}>
                        {topic.description?.trim() || '—'}
                      </td>
                      <td>
                        <StatusBadge status={topicStatus} />
                      </td>
                      <td>
                        <div className={styles.topicActionStack}>
                          <button
                            type="button"
                            className={styles.assignGroupBtn}
                            onClick={() => handleOpenAssignModal(topic)}
                            disabled={!topic.id}
                            title={
                              !topic.id
                                ? 'Topic has no id; cannot be assigned.'
                                : undefined
                            }
                          >
                            <Settings size={14} aria-hidden />
                            Assign to Group
                          </button>
                          <button
                            type="button"
                            className={styles.editTopicBtn}
                            onClick={() => handleOpenEditTopic(topic)}
                            disabled={!topic.id}
                            title="Edit title / description / materials URL"
                          >
                            <Pencil size={14} aria-hidden />
                            Edit
                          </button>
                          {topicStatus === 'OPEN' ? (
                            <button
                              type="button"
                              className={styles.closeTopicBtn}
                              onClick={() =>
                                void handleTopicTransition(topic, 'CLOSED')
                              }
                              disabled={
                                !topic.id || !canClose || inflight !== null
                              }
                              title={
                                canClose
                                  ? 'Close this topic — students will no longer be able to join.'
                                  : 'Closing is not allowed in the current status.'
                              }
                            >
                              {inflight === 'CLOSED' ? (
                                <Loader
                                  size={14}
                                  className={styles.spinningIcon}
                                  aria-hidden
                                />
                              ) : (
                                <ToggleRight size={14} aria-hidden />
                              )}
                              Close
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={styles.openTopicBtn}
                              onClick={() =>
                                void handleTopicTransition(topic, 'OPEN')
                              }
                              disabled={
                                !topic.id || !canOpen || inflight !== null
                              }
                              title={
                                canOpen
                                  ? 'Re-open this topic.'
                                  : 'Re-opening is not allowed in the current status.'
                              }
                            >
                              {inflight === 'OPEN' ? (
                                <Loader
                                  size={14}
                                  className={styles.spinningIcon}
                                  aria-hidden
                                />
                              ) : (
                                <ToggleLeft size={14} aria-hidden />
                              )}
                              Reopen
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.completeTopicBtn}
                            onClick={() =>
                              void handleTopicTransition(topic, 'COMPLETED')
                            }
                            disabled={
                              !topic.id || !canComplete || inflight !== null
                            }
                            title={
                              canComplete
                                ? 'Mark this topic as completed — archival step.'
                                : 'Topic must be in ASSIGNED status to be marked as completed.'
                            }
                          >
                            {inflight === 'COMPLETED' ? (
                              <Loader
                                size={14}
                                className={styles.spinningIcon}
                                aria-hidden
                              />
                            ) : (
                              <CheckCircle2 size={14} aria-hidden />
                            )}
                            Mark Completed
                          </button>
                          <button
                            type="button"
                            className={styles.materialsTopicBtn}
                            onClick={() => handleOpenMaterials(topic)}
                            disabled={!topic.id}
                            title="Manage the learning materials scoped to this topic"
                          >
                            <Library size={14} aria-hidden />
                            Manage Materials
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  className={styles.formInput}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="AI Speech-to-Text Research Team"
                  required
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
                  className={styles.formInput}
                  value={groupDeadline}
                  onChange={(e) => setGroupDeadline(e.target.value)}
                />
                <span className={styles.helperText}>
                  ISO timestamp is sent to the BE. Leave blank if not yet decided.
                </span>
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

      {/* CREATE TOPIC MODAL */}
      {showCreateTopicModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span
                  className={styles.modalIconCircle}
                  style={{ backgroundColor: '#faf5ff', color: '#7c3aed' }}
                >
                  <Lightbulb size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Create New Research Topic</h3>
                  <span className={styles.modalSubtitle}>
                    Define a topic to be assigned to research groups
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowCreateTopicModal(false)}
                aria-label="Close"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <form onSubmit={handleCreateTopicSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="topicName">
                  * Topic Name
                </label>
                <input
                  id="topicName"
                  type="text"
                  className={styles.formInput}
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="High-Concurrency Load Balancing in Microservices"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="topicDesc">
                  Description
                </label>
                <textarea
                  id="topicDesc"
                  className={styles.formTextarea}
                  value={topicDesc}
                  onChange={(e) => setTopicDesc(e.target.value)}
                  placeholder="Architectural strategies for decoupling routing logic from orchestration layers."
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="topicMaterialsUrl">
                  Reference Materials URL
                </label>
                <div className={styles.materialsBox}>
                  <input
                    id="topicMaterialsUrl"
                    type="url"
                    className={styles.materialsInput}
                    value={topicMaterialsUrl}
                    onChange={(e) => setTopicMaterialsUrl(e.target.value)}
                    placeholder="https://firebasestorage.googleapis.com/.../syllabus.pdf"
                  />
                  <div className={styles.materialsHint}>
                    <FileText size={12} aria-hidden style={{ marginRight: 4 }} />
                    Paste a single Firebase Storage URL. Multiple-file uploads land
                    in a future sprint — for now, link to a single canonical PDF.
                  </div>
                </div>
              </div>

              {createTopicError && (
                <div className={styles.errorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{createTopicError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowCreateTopicModal(false)}
                  disabled={isCreatingTopic}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitNavyBtn}
                  disabled={isCreatingTopic}
                >
                  {isCreatingTopic ? (
                    <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  ) : (
                    <Check size={14} aria-hidden />
                  )}
                  {isCreatingTopic ? 'Creating…' : 'Create Research Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN TOPIC MODAL */}
      <AssignTopicModal
        isOpen={showAssignModal}
        topic={topicForAssign}
        groups={groups}
        onClose={() => setShowAssignModal(false)}
        onSuccess={(outcomes) => {
          const ok = outcomes.filter((o) => o.ok).length;
          showBanner(`Topic assigned to ${ok} group(s).`);
          void refreshAll();
        }}
      />

      {/* EDIT TOPIC MODAL (L3.a) — reuses the same shell as Create Topic */}
      {topicForEdit && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span
                  className={styles.modalIconCircle}
                  style={{ backgroundColor: '#faf5ff', color: '#7c3aed' }}
                >
                  <Lightbulb size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Edit Research Topic</h3>
                  <span className={styles.modalSubtitle}>
                    Topic #{topicForEdit.id ?? '—'} — title, description and reference URL
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={handleCloseEditTopic}
                aria-label="Close edit topic modal"
                disabled={isEditingTopic}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <form onSubmit={handleEditTopicSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="editTopicTitle">
                  * Topic Name
                </label>
                <input
                  id="editTopicTitle"
                  type="text"
                  className={styles.formInput}
                  value={editTopicTitle}
                  onChange={(e) => setEditTopicTitle(e.target.value)}
                  placeholder="Topic title"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="editTopicDesc">
                  Description
                </label>
                <textarea
                  id="editTopicDesc"
                  className={styles.formTextarea}
                  value={editTopicDesc}
                  onChange={(e) => setEditTopicDesc(e.target.value)}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="editTopicMaterialsUrl">
                  Reference Materials URL
                </label>
                <div className={styles.materialsBox}>
                  <input
                    id="editTopicMaterialsUrl"
                    type="url"
                    className={styles.materialsInput}
                    value={editTopicMaterialsUrl}
                    onChange={(e) =>
                      setEditTopicMaterialsUrl(e.target.value)
                    }
                    placeholder="https://firebasestorage.googleapis.com/.../syllabus.pdf"
                  />
                </div>
              </div>

              {editTopicError && (
                <div className={styles.errorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{editTopicError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={handleCloseEditTopic}
                  disabled={isEditingTopic}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitNavyBtn}
                  disabled={isEditingTopic}
                >
                  {isEditingTopic ? (
                    <Loader
                      size={14}
                      className={styles.spinningIcon}
                      aria-hidden
                    />
                  ) : (
                    <Check size={14} aria-hidden />
                  )}
                  {isEditingTopic ? 'Saving…' : 'Save Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE TOPIC MATERIALS MODAL (L3.c) */}
      <LearningMaterialModal
        isOpen={topicForMaterials !== null}
        topic={topicForMaterials}
        onClose={handleCloseMaterials}
        onSuccess={() => void refetchTopics()}
      />
    </div>
  );
};

export default ResearchGroup;
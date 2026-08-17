// Lecturer Group Detail — Phase C, contract §3.1 / L2.
//
// Replaces the lead-owned placeholder with the real Lecturer-facing
// group detail surface. The page renders:
//
//   1. Header (group name + back navigation).
//   2. Metadata strip (Deadline, AssignedAt, derived status).
//   3. Members list (`groupMemberService.getMembersForGroup`).
//   4. Phased Report status counts (via the shared `countPhasedReportsByStatus`).
//   5. Milestone summary card using the shared `<MilestoneProgress />`.
//   6. Learning Materials list (filtered client-side — no BE group FK).
//   7. "Edit group" affordance (PUT /api/ResearchGroup/{id}).
//
// All modals/affordances live inline for this small page; the
// contract-§15.1 split-out rule applies to pages with multi-step forms,
// not the light "Edit Group" pattern here.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader,
  AlertTriangle,
  RefreshCw,
  Users,
  Calendar,
  Clock,
  Pencil,
  Check,
  X,
  FileText,
  ExternalLink,
  Library,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import { usePhasedReports } from '../../hooks/usePhasedReports';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import { useLecturerProfile } from '../../hooks/useLecturerProfile';
import { researchGroupService, deriveGroupStatus } from '../../services/researchGroup.service';
import type { ResearchGroup } from '../../services/researchGroup.service';
import {
  groupMemberService,
  type GroupMember,
} from '../../services/groupMember.service';
import { useResearchTopics } from '../../hooks/useResearchTopics';
import { MilestoneProgress } from '../../components/research/MilestoneProgress';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { ROUTES } from '../../routes/paths';
import styles from './GroupDetail.module.css';

interface BannerState {
  visible: boolean;
  text: string;
  variant: 'success' | 'error';
}

const formatDateOnly = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDeadlineForInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export const LecturerGroupDetail = (): JSX.Element => {
  const { groupId: rawGroupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const parsedGroupId = useMemo<number | null>(() => {
    if (!rawGroupId) return null;
    const n = Number(rawGroupId);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [rawGroupId]);

  const {
    groups,
    isLoading: isGroupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useResearchGroups();

  // The single group this page is about.
  const group: ResearchGroup | null = useMemo(() => {
    if (parsedGroupId === null) return null;
    return groups.find((g) => g.id === parsedGroupId) ?? null;
  }, [groups, parsedGroupId]);

  // Members of the group (BE has no `?researchGroupId=`, so we filter client-side).
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState<boolean>(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (parsedGroupId === null) return;
    setIsMembersLoading(true);
    setMembersError(null);
    try {
      const rows = await groupMemberService.getMembersForGroup(parsedGroupId);
      setMembers(rows);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load group members.';
      setMembersError(message);
      setMembers([]);
    } finally {
      setIsMembersLoading(false);
    }
  }, [parsedGroupId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  // Phased Reports — used by the milestone summary card.
  const {
    reports,
    isLoading: isReportsLoading,
    error: reportsError,
    refetch: refetchReports,
  } = usePhasedReports(parsedGroupId);

  // Learning Materials filtered by lecturerId.
  const lecturerId = group?.lecturerId ?? user?.userId ?? null;
  const {
    materials,
    isLoading: isMaterialsLoading,
    error: materialsError,
    refetch: refetchMaterials,
  } = useLearningMaterials({ lecturerId });

  // Related topic — needed for derived group status.
  const { topics } = useResearchTopics();
  const relatedTopic = useMemo(() => {
    if (!group || typeof group.topicId !== 'number') return null;
    return topics.find((t) => t.id === group.topicId) ?? null;
  }, [group, topics]);

  const derivedStatus = useMemo(
    () => deriveGroupStatus(group, relatedTopic?.status ?? null),
    [group, relatedTopic],
  );

  // Lecturer display name for the group owner chip.
  const ownerLecturerId =
    typeof group?.lecturerId === 'number' && group.lecturerId > 0
      ? group.lecturerId
      : null;
  const { displayName: ownerName } = useLecturerProfile(ownerLecturerId);

  // ── Banner state ──────────────────────────────────────────────────────
  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    text: '',
    variant: 'success',
  });

  // ── Edit Group modal state (L2.g) ─────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [editGroupError, setEditGroupError] = useState<string | null>(null);

  const openEditModal = () => {
    if (!group) return;
    setEditName(typeof group.name === 'string' ? group.name : '');
    setEditDesc(typeof group.description === 'string' ? group.description : '');
    setEditDeadline(formatDeadlineForInput(group.deadline ?? null));
    setEditGroupError(null);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (isSavingGroup) return;
    setShowEditModal(false);
  };

  const handleEditGroupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!group || typeof group.id !== 'number') {
      setEditGroupError('This group is missing an id and cannot be saved.');
      return;
    }
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditGroupError('Group name is required.');
      return;
    }
    setIsSavingGroup(true);
    setEditGroupError(null);
    try {
      await researchGroupService.update(group.id, {
        name: trimmedName,
        description: editDesc.trim() || null,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
      });
      setShowEditModal(false);
      setBanner({
        visible: true,
        text: `Group "${trimmedName}" saved successfully.`,
        variant: 'success',
      });
      await refetchGroups();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'The server rejected the group update.';
      setEditGroupError(message);
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleRefreshAll = async () => {
    try {
      await Promise.all([
        refetchGroups(),
        refetchReports(),
        refetchMaterials(),
        loadMembers(),
      ]);
    } catch (err) {
      // Errors are surfaced via the per-card banners, no top-level surface
      // needed. We swallow here so the refresh button never throws.
      void err;
    }
  };

  // ── Empty / not-found states ─────────────────────────────────────────
  if (parsedGroupId === null) {
    return (
      <div className={styles.root} data-testid="lecturer-group-detail">
        <div className={styles.errorPanel}>
          <AlertTriangle size={18} aria-hidden />
          <span>
            The URL is missing a numeric <code>:groupId</code> route param.
            Go back to <Link to={ROUTES.RESEARCH_GROUP}>Research Groups</Link>.
          </span>
        </div>
      </div>
    );
  }

  if (isGroupsLoading) {
    return (
      <div className={styles.root} data-testid="lecturer-group-detail">
        <div className={styles.loadingPanel}>
          <Loader size={18} className={styles.spinningIcon} aria-hidden />
          Loading group…
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className={styles.root} data-testid="lecturer-group-detail">
        <div className={styles.errorPanel}>
          <AlertTriangle size={18} aria-hidden />
          <span>
            No research group with id <code>#{parsedGroupId}</code> was found.
            It may have been deleted, or you may not have access to it.
          </span>
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => void refetchGroups()}
        >
          <RefreshCw size={14} aria-hidden />
          Retry
        </button>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate(ROUTES.RESEARCH_GROUP)}
        >
          <ArrowLeft size={14} aria-hidden />
          Back to Research Groups
        </button>
      </div>
    );
  }

  const groupName = group.name ?? `Group #${group.id ?? '—'}`;

  return (
    <div className={styles.root} data-testid="lecturer-group-detail">
      {/* HEADER */}
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate(ROUTES.RESEARCH_GROUP)}
            aria-label="Back to research groups"
          >
            <ArrowLeft size={14} aria-hidden />
            Back
          </button>
          <div className={styles.headerTitleBlock}>
            <h1 className={styles.pageTitle}>{groupName}</h1>
            <span className={styles.pageSubtitle}>
              Research Group #{group.id ?? '—'} · Owner {ownerName}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <StatusBadge status={derivedStatus} />
          <button
            type="button"
            className={styles.editGroupBtn}
            onClick={openEditModal}
            title="Edit group metadata"
          >
            <Pencil size={14} aria-hidden />
            Edit group
          </button>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void handleRefreshAll()}
          >
            <RefreshCw size={14} aria-hidden />
            Refresh
          </button>
        </div>
      </header>

      {/* BANNER */}
      {banner.visible && (
        <div
          className={`${styles.banner} ${
            banner.variant === 'success' ? styles.bannerSuccess : styles.bannerError
          }`}
          role="status"
        >
          <span className={styles.bannerIcon}>
            {banner.variant === 'success' ? (
              <CheckCircle2 size={14} aria-hidden />
            ) : (
              <AlertTriangle size={14} aria-hidden />
            )}
          </span>
          <span className={styles.bannerText}>{banner.text}</span>
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

      {groupsError && (
        <div className={styles.errorPanel} role="alert">
          <AlertTriangle size={14} aria-hidden />
          <span>Could not load the latest group metadata: {groupsError.message}</span>
        </div>
      )}

      {/* METADATA STRIP */}
      <section className={styles.metaStrip}>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <Calendar size={12} aria-hidden /> Deadline
          </span>
          <span className={styles.metaValue}>
            {formatDateOnly(group.deadline ?? null)}
          </span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <Clock size={12} aria-hidden /> Assigned at
          </span>
          <span className={styles.metaValue}>
            {formatDateTime(group.assignedAt ?? null)}
          </span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <Users size={12} aria-hidden /> Members
          </span>
          <span className={styles.metaValue}>
            {members.length}
            {isMembersLoading ? ' (loading…)' : ''}
          </span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <FileText size={12} aria-hidden /> Phased reports
          </span>
          <span className={styles.metaValue}>
            {reports.length}
            {isReportsLoading ? ' (loading…)' : ''}
          </span>
        </div>
      </section>

      {/* MILESTONE SUMMARY (L2.e) */}
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Milestone summary</h2>
          <span className={styles.cardHint}>
            Visual summary of all Phased Reports this group has submitted.
          </span>
        </header>
        {reportsError && (
          <div className={styles.errorPanel} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span>Could not load reports: {reportsError.message}</span>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => void refetchReports()}
            >
              Retry
            </button>
          </div>
        )}
        {reports.length === 0 && !isReportsLoading && !reportsError && (
          <div className={styles.emptyState}>
            <FileText size={18} aria-hidden />
            <span>
              No phased reports have been submitted for this group yet.
            </span>
          </div>
        )}
        {reports.length > 0 && (
          <MilestoneProgress reports={reports} className={styles.cardInner} />
        )}
        {/* BE-gap banner — the canonical /api/Milestone endpoint does not
            exist yet (gap ticket §E.6.2 / §C.3). Once the BE ships the
            milestone entity we can replace this section with a richer
            timeline component. */}
        <div className={styles.gapNote} role="note">
          <AlertTriangle size={14} aria-hidden />
          <span>
            The BE does not yet expose <code>GET /api/Milestone</code>. This
            card counts Phased Reports as a stand-in. A real milestone
            timeline ships once BE adds the resource per gap ticket §E.6.2.
          </span>
        </div>
      </section>

      {/* MEMBERS LIST (L2.b) */}
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <Users size={16} aria-hidden /> Group members
          </h2>
          <span className={styles.cardHint}>
            Student IDs joined this group. BE has no server-side filter
            (<code>?researchGroupId=</code>), so we filter client-side.
          </span>
        </header>
        {membersError && (
          <div className={styles.errorPanel} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span>{membersError}</span>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => void loadMembers()}
            >
              Retry
            </button>
          </div>
        )}
        {isMembersLoading ? (
          <div className={styles.loadingPanel}>
            <Loader size={14} className={styles.spinningIcon} aria-hidden />
            Loading members…
          </div>
        ) : members.length === 0 ? (
          <div className={styles.emptyState}>
            <Users size={18} aria-hidden />
            <span>
              No students have joined this group yet. Use the Members tab to
              send invitations.
            </span>
          </div>
        ) : (
          <ul className={styles.memberList}>
            {members.map((m) => {
              const mid = typeof m.id === 'number' ? m.id : -1;
              return (
                <li key={`member-${mid}`} className={styles.memberRow}>
                  <span className={styles.memberId}>
                    Member #{mid >= 0 ? mid : '—'}
                  </span>
                  <span className={styles.memberStudent}>
                    Student #{m.studentId ?? '—'}
                  </span>
                  <span className={styles.memberStatus}>
                    {m.activityStatus ?? 'ACTIVE'}
                  </span>
                  <span className={styles.memberJoined}>
                    joined{' '}
                    {formatDateOnly(m.joinedAt ?? null)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* LEARNING MATERIALS (L2.c) */}
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <Library size={16} aria-hidden /> Learning materials
          </h2>
          <span className={styles.cardHint}>
            Scoped to your lecturer library. BE has no group FK so we filter
            by <code>lecturerId</code>.
          </span>
        </header>
        {materialsError && (
          <div className={styles.errorPanel} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span>{materialsError.message}</span>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => void refetchMaterials()}
            >
              Retry
            </button>
          </div>
        )}
        {isMaterialsLoading ? (
          <div className={styles.loadingPanel}>
            <Loader size={14} className={styles.spinningIcon} aria-hidden />
            Loading materials…
          </div>
        ) : materials.length === 0 ? (
          <div className={styles.emptyState}>
            <Library size={18} aria-hidden />
            <span>
              No learning materials attached to this group yet. Create one
              from the Research Topic row "Manage Materials" button.
            </span>
          </div>
        ) : (
          <ul className={styles.materialList}>
            {materials.map((m) => {
              const id = typeof m.id === 'number' ? m.id : -1;
              const title = (m.title ?? '').trim() || `Material #${id}`;
              return (
                <li key={`mat-${id}`} className={styles.materialRow}>
                  <div className={styles.materialMeta}>
                    <span className={styles.materialTitle}>{title}</span>
                    {m.description?.trim() && (
                      <span className={styles.materialDesc}>
                        {m.description}
                      </span>
                    )}
                  </div>
                  {m.fileUrl && (
                    <a
                      className={styles.openLink}
                      href={m.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} aria-hidden />
                      Open
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* EDIT GROUP MODAL (L2.g) */}
      {showEditModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <Pencil size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Edit group metadata</h3>
                  <span className={styles.modalSubtitle}>
                    {groupName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeEditModal}
                disabled={isSavingGroup}
                aria-label="Close edit group modal"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <form
              onSubmit={handleEditGroupSubmit}
              className={styles.modalForm}
              data-testid="edit-group-form"
            >
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="groupName">
                  * Group name
                </label>
                <input
                  id="groupName"
                  type="text"
                  className={styles.formInput}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="groupDeadline">
                  Deadline
                </label>
                <input
                  id="groupDeadline"
                  type="date"
                  className={styles.formInput}
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                />
              </div>

              {editGroupError && (
                <div className={styles.errorPanel} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{editGroupError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeEditModal}
                  disabled={isSavingGroup}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={isSavingGroup}
                >
                  {isSavingGroup ? (
                    <Loader
                      size={14}
                      className={styles.spinningIcon}
                      aria-hidden
                    />
                  ) : (
                    <Check size={14} aria-hidden />
                  )}
                  {isSavingGroup ? 'Saving…' : 'Save group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerGroupDetail;
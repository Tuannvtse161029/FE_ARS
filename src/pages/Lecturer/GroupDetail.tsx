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
  UserPlus,
  Crown,
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
import { FieldError } from '../../components/FieldError';
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
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [editDeadlineError, setEditDeadlineError] = useState<string | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [editGroupError, setEditGroupError] = useState<string | null>(null);

  const openEditModal = () => {
    if (!group) return;
    setEditName(typeof group.name === 'string' ? group.name : '');
    setEditDesc(typeof group.description === 'string' ? group.description : '');
    setEditDeadline(formatDeadlineForInput(group.deadline ?? null));
    setEditGroupError(null);
    setEditNameError(null);
    setEditDeadlineError(null);
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
    const nameErr = trimmedName ? null : 'Group name is required.';
    let deadlineErr: string | null = null;
    if (editDeadline) {
      const ms = new Date(editDeadline).getTime();
      if (Number.isNaN(ms)) deadlineErr = 'Deadline is not a valid date.';
    }
    setEditNameError(nameErr);
    setEditDeadlineError(deadlineErr);
    if (nameErr || deadlineErr) return;
    setIsSavingGroup(true);
    setEditGroupError(null);
    try {
      await researchGroupService.update(group.id, {
        lecturerId: group.lecturerId ?? null,
        topicId: group.topicId ?? null,
        name: trimmedName,
        description: editDesc.trim() || null,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
        assignedAt: group.assignedAt ?? null,
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

  // ── Invite members modal state ──────────────────────────────────────────
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteEmailsInput, setInviteEmailsInput] = useState<string>('');
  const [isInviting, setIsInviting] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const openInviteModal = () => {
    setInviteEmailsInput('');
    setInviteError(null);
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    if (isInviting) return;
    setShowInviteModal(false);
  };

  const handleInviteStudents = async (e: FormEvent) => {
    e.preventDefault();
    if (parsedGroupId === null) return;
    const emails = inviteEmailsInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (emails.length === 0) {
      setInviteError('Please enter at least one valid email address.');
      return;
    }

    setIsInviting(true);
    setInviteError(null);
    try {
      const res = await researchGroupService.invite(parsedGroupId, emails);
      setShowInviteModal(false);
      setInviteEmailsInput('');
      const successCount = res.successEmails?.length ?? res.totalInvited ?? 0;
      const notFoundCount = res.notFoundEmails?.length ?? 0;
      let msg = `Successfully invited ${successCount} student(s) to the group.`;
      if (notFoundCount > 0) {
        msg += ` (${notFoundCount} email(s) not found in system: ${res.notFoundEmails?.join(', ')})`;
      }
      setBanner({
        visible: true,
        text: msg,
        variant: 'success',
      });
      await loadMembers();
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : 'Failed to send invitations.',
      );
    } finally {
      setIsInviting(false);
    }
  };

  const [leaderActionLoading, setLeaderActionLoading] = useState<number | null>(null);

  const handleSetLeader = async (member: GroupMember) => {
    const memberId = member.groupMemberId ?? member.id;
    if (!memberId) return;
    setLeaderActionLoading(memberId);
    try {
      await groupMemberService.setLeader(memberId, member.studentId ?? undefined);
      setBanner({
        visible: true,
        text: `Đã gán vai trò Trưởng nhóm (Leader) cho ${member.studentName || `Sinh viên #${member.studentId}`}.`,
        variant: 'success',
      });
      await loadMembers();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể gán vai trò Trưởng nhóm.';
      setBanner({
        visible: true,
        text: msg,
        variant: 'error',
      });
    } finally {
      setLeaderActionLoading(null);
    }
  };

  const handleRemoveLeader = async (member: GroupMember) => {
    const memberId = member.groupMemberId ?? member.id;
    if (!memberId) return;
    setLeaderActionLoading(memberId);
    try {
      await groupMemberService.removeLeader(memberId);
      setBanner({
        visible: true,
        text: `Đã hủy vai trò Trưởng nhóm của ${member.studentName || `Sinh viên #${member.studentId}`}.`,
        variant: 'success',
      });
      await loadMembers();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể hủy vai trò Trưởng nhóm.';
      setBanner({
        visible: true,
        text: msg,
        variant: 'error',
      });
    } finally {
      setLeaderActionLoading(null);
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

      {/* ASSIGNED TOPIC SUMMARY (Lecturer Navigation Agent) — read-only link
          to the canonical Research Topics page. CRUD for topics lives on
          that page; this card is just the entry point from the group
          detail view. */}
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Assigned topic
          </h2>
          <span className={styles.cardHint}>
            The Research Topic this group is working on. Manage topics on the{' '}
            <Link to={ROUTES.LECTURER_RESEARCH_TOPICS}>Research Topics</Link>{' '}
            page.
          </span>
        </header>
        {relatedTopic ? (
          <div className={styles.cardInner} data-testid="group-detail-topic-summary">
            <StatusBadge status={deriveGroupStatus(group, relatedTopic.status)} />
            <span className={styles.topicSummaryText}>
              <strong>{relatedTopic.title ?? `RT-${group.topicId}`}</strong>
              {relatedTopic.description?.trim() && (
                <div className={styles.topicSummaryDesc}>
                  {relatedTopic.description}
                </div>
              )}
            </span>
            <Link
              to={ROUTES.LECTURER_RESEARCH_TOPICS}
              className={styles.openLink}
              data-testid="group-detail-topic-link"
            >
              <ExternalLink size={14} aria-hidden /> Open topic
            </Link>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span>
              No research topic has been assigned to this group yet. Open{' '}
              <Link to={ROUTES.LECTURER_RESEARCH_TOPICS}>Research Topics</Link>{' '}
              to assign one.
            </span>
          </div>
        )}
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
          <div className={styles.cardHeaderRow}>
            <h2 className={styles.cardTitle}>
              <Users size={16} aria-hidden /> Group members ({members.length})
            </h2>
            <button
              type="button"
              className={styles.inviteStudentsBtn}
              onClick={openInviteModal}
            >
              <UserPlus size={14} aria-hidden /> Invite students
            </button>
          </div>
          <span className={styles.cardHint}>
            Manage student members in this group. You can invite new students directly by email.
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
              const isBusy = leaderActionLoading === mid;
              return (
                <li key={`member-${mid}`} className={styles.memberRow} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: m.isLeader ? '#fef3c7' : '#e0e7ff',
                        color: m.isLeader ? '#b45309' : '#3730a3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    >
                      {m.isLeader ? <Crown size={18} /> : (m.studentName ? m.studentName.slice(0, 2).toUpperCase() : 'ST')}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                          {m.studentName || `Student #${m.studentId ?? mid}`}
                        </strong>
                        {m.isLeader && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                            }}
                          >
                            <Crown size={12} /> Trưởng nhóm (Leader)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                        {m.studentEmail && <span>{m.studentEmail} · </span>}
                        <span>Status: <strong>{m.activityStatus ?? 'Joined'}</strong></span>
                        <span> · Joined {formatDateOnly(m.joinedAt ?? null)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {m.isLeader ? (
                      <button
                        type="button"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #fca5a5',
                          backgroundColor: '#fef2f2',
                          color: '#b91c1c',
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => void handleRemoveLeader(m)}
                        disabled={isBusy}
                      >
                        {isBusy ? <Loader size={12} className={styles.spinningIcon} /> : <X size={14} />}
                        Hủy Trưởng nhóm
                      </button>
                    ) : (
                      <button
                        type="button"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          cursor: isBusy ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => void handleSetLeader(m)}
                        disabled={isBusy}
                      >
                        {isBusy ? <Loader size={12} className={styles.spinningIcon} /> : <Crown size={14} color="#d97706" />}
                        Gán Trưởng nhóm
                      </button>
                    )}
                  </div>
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
                className={`${styles.formInput} ${editNameError ? styles.formInputError : ''}`}
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  if (editNameError) setEditNameError(null);
                }}
                aria-invalid={Boolean(editNameError)}
                aria-describedby={editNameError ? 'gd-group-name-error' : undefined}
                required
              />
              <FieldError id="gd-group-name-error" message={editNameError} testId="gd-group-name-error" />
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
                className={`${styles.formInput} ${editDeadlineError ? styles.formInputError : ''}`}
                value={editDeadline}
                onChange={(e) => {
                  setEditDeadline(e.target.value);
                  if (editDeadlineError) setEditDeadlineError(null);
                }}
                aria-invalid={Boolean(editDeadlineError)}
                aria-describedby={editDeadlineError ? 'gd-deadline-error' : undefined}
              />
              <FieldError id="gd-deadline-error" message={editDeadlineError} testId="gd-deadline-error" />
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

      {/* INVITE STUDENTS MODAL */}
      {showInviteModal && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inviteStudentsModalTitle"
        >
          <div className={styles.modal}>
            <header className={styles.modalHeader}>
              <h2 id="inviteStudentsModalTitle" className={styles.modalTitle}>
                <UserPlus size={18} aria-hidden /> Invite Students to Research Group
              </h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={closeInviteModal}
                disabled={isInviting}
                aria-label="Close modal"
              >
                <X size={16} aria-hidden />
              </button>
            </header>

            <form onSubmit={handleInviteStudents} className={styles.modalForm} noValidate>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="inviteEmails">
                  Student Email Addresses (separated by commas or newlines)
                </label>
                <textarea
                  id="inviteEmails"
                  className={styles.formTextarea}
                  rows={4}
                  placeholder="student1@gmail.com, student2@fpt.edu.vn"
                  value={inviteEmailsInput}
                  onChange={(e) => {
                    setInviteEmailsInput(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  disabled={isInviting}
                />
                <span className={styles.cardHint}>
                  The system will automatically find student accounts and add them as group members.
                </span>
              </div>

              {inviteError && (
                <div className={styles.errorPanel} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{inviteError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeInviteModal}
                  disabled={isInviting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={isInviting || !inviteEmailsInput.trim()}
                >
                  {isInviting ? (
                    <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  ) : (
                    <Check size={14} aria-hidden />
                  )}
                  {isInviting ? 'Sending Invites…' : 'Send Invitations'}
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
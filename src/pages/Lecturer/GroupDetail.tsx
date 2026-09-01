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
import { PhaseTimeline, type PhaseTimelineItem } from '../../components/research/PhaseTimeline';
import { InlineNotice } from '../../components/InlineNotice/InlineNotice';
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

  const group: ResearchGroup | null = useMemo(() => {
    if (parsedGroupId === null) return null;
    return groups.find((g) => g.id === parsedGroupId) ?? null;
  }, [groups, parsedGroupId]);

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState<boolean>(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const da = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
      const db = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
      return db - da; // most recently joined first
    });
  }, [members]);

  const loadMembers = useCallback(async () => {
    if (parsedGroupId === null) return;
    setIsMembersLoading(true);
    setMembersError(null);
    try {
      const rows = await groupMemberService.getMembersForGroup(parsedGroupId);
      setMembers(rows);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Failed to load group members.');
      setMembers([]);
    } finally {
      setIsMembersLoading(false);
    }
  }, [parsedGroupId]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  const {
    reports,
    isLoading: isReportsLoading,
    error: reportsError,
    refetch: refetchReports,
  } = usePhasedReports(parsedGroupId);

  const lecturerId = group?.lecturerId ?? user?.userId ?? null;
  const {
    materials,
    isLoading: isMaterialsLoading,
    error: materialsError,
    refetch: refetchMaterials,
  } = useLearningMaterials({ lecturerId });

  const { topics } = useResearchTopics();
  const relatedTopic = useMemo(() => {
    if (!group || typeof group.topicId !== 'number') return null;
    return topics.find((t) => t.id === group.topicId) ?? null;
  }, [group, topics]);

  const derivedStatus = useMemo(
    () => deriveGroupStatus(group, relatedTopic?.status ?? null),
    [group, relatedTopic],
  );

  // Phase timeline derived from the live PhasedReport API. Each phase
  // collapses to one timeline item; the state reflects the highest-
  // priority submission state found for the phase.
  const phaseTimelineItems = useMemo<PhaseTimelineItem[]>(() => {
    const byPhase = new Map<number, typeof reports[number]>();
    for (const r of reports) {
      if (typeof r.phaseNumber !== 'number') continue;
      const existing = byPhase.get(r.phaseNumber);
      // Prefer the most-recently-submitted row for this phase.
      if (!existing || (r.submittedAt ?? '') > (existing.submittedAt ?? '')) {
        byPhase.set(r.phaseNumber, r);
      }
    }
    const phases = Array.from(byPhase.keys()).sort((a, b) => a - b);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return phases.map((phaseNumber) => {
      const report = byPhase.get(phaseNumber);
      const status = (report?.status ?? '').toLowerCase();
      const deadlineMs = report?.deadlineAt
        ? new Date(report.deadlineAt).getTime()
        : NaN;
      const overdue = Boolean(
        report?.isOverdue ??
          (report?.submittedAt && report?.deadlineAt &&
            new Date(report.submittedAt) > new Date(report.deadlineAt)),
      );
      let state: PhaseTimelineItem['state'] = 'upcoming';
      if (status === 'evaluated' || status === 'passed' || status === 'approved') {
        state = 'accepted';
      } else if (status === 'submitted' || status === 'pending_review') {
        state = overdue ? 'overdue' : 'submitted';
      } else if (
        Number.isFinite(deadlineMs) &&
        deadlineMs < now &&
        status !== 'rejected' &&
        status !== 'denied'
      ) {
        state = 'overdue';
      } else if (
        Number.isFinite(deadlineMs) &&
        deadlineMs - now <= 7 * dayMs &&
        deadlineMs >= now
      ) {
        state = 'dueSoon';
      }
      return {
        number: phaseNumber,
        title: report?.milestoneTitle ?? '',
        state,
        deadline: report?.deadlineAt ?? null,
        submittedAt: report?.submittedAt ?? null,
      };
    });
  }, [reports]);

  const ownerLecturerId =
    typeof group?.lecturerId === 'number' && group.lecturerId > 0
      ? group.lecturerId
      : null;
  const { displayName: ownerName } = useLecturerProfile(ownerLecturerId);

  // Banner state
  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    text: '',
    variant: 'success',
  });

  // Edit Group modal
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
      setEditGroupError(
        err instanceof Error
          ? err.message
          : 'The server rejected the group update.',
      );
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Invite students modal
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteEmailsInput, setInviteEmailsInput] = useState<string>('');
  const [isInviting, setIsInviting] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const openInviteModal = () => {
    if (members.length >= 4) {
      setInviteError('This group already has the maximum of 4 members. Remove a member before inviting another.');
      return;
    }
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
    if (members.length + emails.length > 4) {
      setInviteError(`A group can have at most 4 members. You can invite ${Math.max(0, 4 - members.length)} more student(s).`);
      return;
    }
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
      setBanner({ visible: true, text: msg, variant: 'success' });
      await loadMembers();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = e?.response?.status;
      setInviteError(
        status === 401
          ? 'Your session has expired. Please sign in again.'
          : status === 403
            ? 'You are not allowed to invite students to this group.'
            : e?.response?.data?.message || e?.message || 'Failed to send invitations.',
      );
    } finally {
      setIsInviting(false);
    }
  };

  const [leaderActionLoading, setLeaderActionLoading] = useState<number | null>(null);

  const handleSetLeader = async (member: GroupMember) => {
    const memberId = member.groupMemberId ?? member.id;
    if (!memberId) return;
    const currentLeader = members.find((candidate) => candidate.isLeader);
    if (currentLeader && currentLeader.id !== memberId) {
      const currentName = currentLeader.studentName || `Student #${currentLeader.studentId ?? currentLeader.id}`;
      const nextName = member.studentName || `Student #${member.studentId ?? member.id}`;
      if (!window.confirm(`Replace ${currentName} as group leader with ${nextName}?`)) return;
    }
    setLeaderActionLoading(memberId);
    try {
      await groupMemberService.setLeader(memberId, member.studentId ?? undefined);
      setBanner({
        visible: true,
        text: `Đã gán vai trò Trưởng nhóm (Leader) cho ${member.studentName || `Sinh viên #${member.studentId}`}.`,
        variant: 'success',
      });
      await loadMembers();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = e?.response?.status;
      const msg = status === 401
        ? 'Your session has expired. Please sign in again.'
        : status === 403
          ? 'You are not allowed to change the group leader.'
          : e?.response?.data?.message || e?.message || 'Unable to assign group leader.';
      setBanner({ visible: true, text: msg, variant: 'error' });
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
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = e?.response?.status;
      const msg = status === 401
        ? 'Your session has expired. Please sign in again.'
        : status === 403
          ? 'You are not allowed to change the group leader.'
          : e?.response?.data?.message || e?.message || 'Unable to remove group leader.';
      setBanner({ visible: true, text: msg, variant: 'error' });
    } finally {
      setLeaderActionLoading(null);
    }
  };

  const handleRefreshAll = async () => {
    try {
      await Promise.all([refetchGroups(), refetchReports(), refetchMaterials(), loadMembers()]);
    } catch { /* surfaced per-card */ }
  };

  // Not-found / loading states
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
          </span>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={() => void refetchGroups()}>
          <RefreshCw size={14} aria-hidden /> Retry
        </button>
        <button type="button" className={styles.backBtn} onClick={() => navigate(ROUTES.RESEARCH_GROUP)}>
          <ArrowLeft size={14} aria-hidden /> Back to Research Groups
        </button>
      </div>
    );
  }

  const groupName = group.name ?? `Group #${group.id ?? '—'}`;

  return (
    <div className={styles.root} data-testid="lecturer-group-detail">
      {/* Back row — on its own line above the title for clear page hierarchy */}
      <div className={styles.backRow}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate(ROUTES.RESEARCH_GROUP)}
          aria-label="Back to research groups"
        >
          <ArrowLeft size={14} aria-hidden />
          Back
        </button>
      </div>

      {/* Page header — title + subtitle left, status + actions right */}
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitleBlock}>
            <h1 className={styles.pageTitle}>{groupName}</h1>
            <span className={styles.pageSubtitle}>
              Research Group #{group.id ?? '—'} · Owner {ownerName}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <StatusBadge status={derivedStatus} />
          <button type="button" className={styles.editGroupBtn} onClick={openEditModal}>
            <Pencil size={14} aria-hidden />
            Edit group
          </button>
          <button type="button" className={styles.refreshBtn} onClick={() => void handleRefreshAll()}>
            <RefreshCw size={14} aria-hidden />
            Refresh
          </button>
        </div>
      </header>

      {/* Banner */}
      {banner.visible && (
        <div
          className={`${styles.banner} ${banner.variant === 'success' ? styles.bannerSuccess : styles.bannerError}`}
          role="status"
        >
          <span className={styles.bannerIcon}>
            {banner.variant === 'success'
              ? <CheckCircle2 size={14} aria-hidden />
              : <AlertTriangle size={14} aria-hidden />}
          </span>
          <span className={styles.bannerText}>{banner.text}</span>
          <button
            type="button"
            className={styles.bannerCloseBtn}
            onClick={() => setBanner({ visible: false, text: '', variant: 'success' })}
            aria-label="Dismiss"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {groupsError && (
        <div className={styles.errorPanel} role="alert">
          <AlertTriangle size={14} aria-hidden />
          <span>Could not load group metadata: {groupsError.message}</span>
          <button type="button" className={styles.retryBtn} onClick={() => void refetchGroups()}>
            Retry
          </button>
        </div>
      )}

      {/* Metadata strip */}
      <section className={styles.metaStrip}>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <Calendar size={12} aria-hidden /> Deadline
          </span>
          <span className={styles.metaValue}>{formatDateOnly(group.deadline ?? null)}</span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <Clock size={12} aria-hidden /> Assigned at
          </span>
          <span className={styles.metaValue}>{formatDateTime(group.assignedAt ?? null)}</span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <Users size={12} aria-hidden /> Members
          </span>
          <span className={styles.metaValue}>
            {members.length}{isMembersLoading ? ' (loading\u2026)' : ''}
          </span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <FileText size={12} aria-hidden /> Phased reports
          </span>
          <span className={styles.metaValue}>
            {reports.length}{isReportsLoading ? ' (loading\u2026)' : ''}
          </span>
        </div>
      </section>

      {/* Assigned topic */}
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Assigned topic</h2>
          <span className={styles.cardHint}>
            The Research Topic this group is working on. Manage topics on the{' '}
            <Link to={ROUTES.LECTURER_RESEARCH_TOPICS}>Research Topics</Link> page.
          </span>
        </header>
        {relatedTopic ? (
          <div className={styles.cardBody}>
            <div className={styles.cardInner}>
              <StatusBadge status={deriveGroupStatus(group, relatedTopic.status)} />
              <div className={styles.topicSummaryText}>
                <strong className={styles.topicSummaryTitle}>
                  {relatedTopic.title ?? `RT-${group.topicId}`}
                </strong>
                {relatedTopic.description?.trim() && (
                  <span className={styles.topicSummaryDesc}>
                    {relatedTopic.description}
                  </span>
                )}
              </div>
              <Link to={ROUTES.LECTURER_RESEARCH_TOPICS} className={styles.openLink}>
                <ExternalLink size={14} aria-hidden /> Open topic
              </Link>
            </div>
          </div>
        ) : (
          <div className={styles.cardBody}>
            <div className={styles.emptyState}>
              No research topic assigned yet.{' '}
              <Link to={ROUTES.LECTURER_RESEARCH_TOPICS}>Assign one from Research Topics.</Link>
            </div>
          </div>
        )}
      </section>

      {/* Phase progress — visual stepper is the dominant object on this
          page. It reads top-to-bottom in workflow order so the lecturer
          can see exactly where the group is in the journey without
          scanning tables or counts. */}
      {phaseTimelineItems.length > 0 && (
        <section className={styles.card} aria-labelledby="phaseProgressTitle">
          <header className={styles.cardHeader}>
            <h2 id="phaseProgressTitle" className={styles.cardTitle}>
              Phase progress
            </h2>
            <span className={styles.cardHint}>
              Where this group is in the reporting journey.
            </span>
          </header>
          <div className={styles.cardBody}>
            <PhaseTimeline items={phaseTimelineItems} />
          </div>
        </section>
      )}

      {/* Milestone summary */}
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
            <button type="button" className={styles.retryBtn} onClick={() => void refetchReports()}>
              Retry
            </button>
          </div>
        )}
        {reports.length === 0 && !isReportsLoading && !reportsError && (
          <div className={styles.cardBody}>
            <div className={styles.emptyState}>
              <FileText size={18} aria-hidden />
              No phased reports submitted yet.
            </div>
          </div>
        )}
        {reports.length > 0 && (
          <>
            <div className={styles.cardBody}>
              <MilestoneProgress reports={reports} className={styles.cardInner} />
            </div>
            <div className={styles.gapNote}>
              <InlineNotice
                tone="info"
                title="Milestone API unavailable"
                description="A dedicated milestone endpoint is not exposed yet. This card counts Phased Reports as a stand-in."
              />
            </div>
          </>
        )}
      </section>

      {/* Members */}
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
              disabled={members.length >= 4 || isMembersLoading}
              title={members.length >= 4 ? 'Maximum of 4 members reached' : 'Invite students'}
            >
              <UserPlus size={14} aria-hidden /> Invite students
            </button>
          </div>
          <InlineNotice
            tone="info"
            title="Maximum 4 members per group"
            description="The four-member limit is enforced in this interface; the BE contract does not document the constraint."
          />
          <span className={styles.cardHint}>
            Manage student members in this group.
          </span>
        </header>
        {membersError && (
          <div className={styles.errorPanel} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span>{membersError}</span>
            <button type="button" className={styles.retryBtn} onClick={() => void loadMembers()}>
              Retry
            </button>
          </div>
        )}
        {isMembersLoading ? (
          <div className={styles.loadingPanel}>
            <Loader size={14} className={styles.spinningIcon} aria-hidden />
            Loading members\u2026
          </div>
        ) : members.length === 0 ? (
          <div className={styles.emptyState}>
            <Users size={18} aria-hidden />
            No students have joined this group yet.
          </div>
        ) : (
          <ul className={styles.memberList}>
            {sortedMembers.map((m) => {
              const mid = typeof m.id === 'number' ? m.id : -1;
              const isBusy = leaderActionLoading === mid;
              const initials = (m.studentName ?? '').trim().slice(0, 2).toUpperCase() || 'ST';
              return (
                <li key={`member-${mid}`} className={styles.memberRow}>
                  <div className={styles.memberIdentity}>
                    <div
                      className={`${styles.memberAvatar} ${m.isLeader ? styles.memberAvatarLeader : ''}`}
                      aria-hidden
                    >
                      {m.isLeader ? <Crown size={18} /> : initials}
                    </div>
                    <div className={styles.memberBody}>
                      <div className={styles.memberNameRow}>
                        <span className={styles.memberStudent}>
                          {m.studentName || `Student #${m.studentId ?? mid}`}
                        </span>
                        {m.isLeader && (
                          <span className={styles.leaderBadge}>
                            <Crown size={12} aria-hidden />
                            Trưởng nhóm (Leader)
                          </span>
                        )}
                      </div>
                      <div className={styles.memberMeta}>
                        {m.studentEmail && <span>{m.studentEmail}</span>}
                        <span>
                          Status: <strong>{m.activityStatus ?? 'Joined'}</strong>
                        </span>
                        <span>Joined {formatDateOnly(m.joinedAt ?? null)}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.memberActions}>
                    {m.isLeader ? (
                      <button
                        type="button"
                        className={styles.removeLeaderBtn}
                        onClick={() => void handleRemoveLeader(m)}
                        disabled={isBusy}
                      >
                        {isBusy
                          ? <Loader size={12} className={styles.spinningIcon} aria-hidden />
                          : <X size={14} aria-hidden />}
                        Hủy Trưởng nhóm
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.setLeaderBtn}
                        onClick={() => void handleSetLeader(m)}
                        disabled={isBusy}
                      >
                        {isBusy
                          ? <Loader size={12} className={styles.spinningIcon} aria-hidden />
                          : <Crown size={14} className={styles.leaderCrown} aria-hidden />}
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

      {/* Learning materials */}
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <Library size={16} aria-hidden /> Learning materials
          </h2>
          <span className={styles.cardHint}>
            Scoped to your lecturer library.
          </span>
        </header>
        {materialsError && (
          <div className={styles.errorPanel} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span>{materialsError.message}</span>
            <button type="button" className={styles.retryBtn} onClick={() => void refetchMaterials()}>
              Retry
            </button>
          </div>
        )}
        {isMaterialsLoading ? (
          <div className={styles.loadingPanel}>
            <Loader size={14} className={styles.spinningIcon} aria-hidden />
            Loading materials\u2026
          </div>
        ) : materials.length === 0 ? (
          <div className={styles.emptyState}>
            <Library size={18} aria-hidden />
            No learning materials attached yet.
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
                      <span className={styles.materialDesc}>{m.description}</span>
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

      {/* ── Edit Group modal ─────────────────────────────────── */}
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
                  <span className={styles.modalSubtitle}>{groupName}</span>
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
              id="edit-group-form"
              onSubmit={handleEditGroupSubmit}
              className={styles.modalForm}
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
            </form>

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
                form="edit-group-form"
                className={styles.primaryBtn}
                disabled={isSavingGroup}
              >
                {isSavingGroup
                  ? <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  : <Check size={14} aria-hidden />}
                {isSavingGroup ? 'Saving\u2026' : 'Save group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Students modal ──────────────────────────────── */}
      {showInviteModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="inviteStudentsTitle">
          <div className={styles.modal}>
            <header className={styles.modalHeader}>
              <h2 id="inviteStudentsTitle" className={styles.modalTitle}>
                <UserPlus size={18} aria-hidden />
                Invite Students to Research Group
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

            <form
              id="invite-students-form"
              onSubmit={handleInviteStudents}
              className={styles.modalForm}
              noValidate
            >
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="inviteEmails">
                  Student email addresses (separated by commas or new lines)
                </label>
                <textarea
                  id="inviteEmails"
                  className={styles.formTextarea}
                  rows={4}
                  placeholder={'student1@gmail.com\nstudent2@fpt.edu.vn'}
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
            </form>

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
                form="invite-students-form"
                className={styles.primaryBtn}
                disabled={isInviting || !inviteEmailsInput.trim() || members.length >= 4}
              >
                {isInviting
                  ? <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  : <Check size={14} aria-hidden />}
                {isInviting ? 'Sending Invites\u2026' : 'Send Invitations'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerGroupDetail;

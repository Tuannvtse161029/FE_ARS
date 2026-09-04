// Lecturer Group Detail — Phase C, contract §3.1 / L2.
//
// Replaces the lead-owned placeholder with the real Lecturer-facing
// group detail surface. The page renders:
//
//   1. Header (group name + back navigation).
//   2. Metadata strip (AssignedAt, members count, phased report count).
//      NOTE: the group-level `deadline` is intentionally absent — see
//      the inline comment on the metaStrip JSX below; per-phase
//      deadlines are owned by `ConfigureMilestones`.
//   3. Members list (`groupMemberService.getMembersForGroup`).
//   4. Phased Report status counts (via the shared `countPhasedReportsByStatus`).
//   5. Assigned Topic card (opens the shared `OpenTopicModal` from
//      `src/components/lecturer/OpenTopicModal.tsx`).
//   6. Invite-students modal: 3x3 card grid of graduate-student users.
//   7. Learning Materials list (filtered client-side — no BE group FK).
//   8. "Edit group" affordance (PUT /api/ResearchGroup/{id}); the
//      group-level deadline input has been removed alongside the
//      metaStrip cell — deadlines live on individual phases now.
//
// All modals/affordances live inline for this small page; the
// contract-§15.1 split-out rule applies to pages with multi-step forms,
// not the light "Edit Group" pattern here. The shared `OpenTopicModal`
// is imported from its canonical component, so no local placeholder is
// shipped here.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import api from '../../services/axios';
import type { User } from '../../types/auth';
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
import { PhaseTimeline, type PhaseTimelineItem } from '../../components/research/PhaseTimeline';
import { InlineNotice } from '../../components/InlineNotice/InlineNotice';
import { StatusBadge } from '../../components/lecturer/StatusBadge';
import { OpenTopicModal } from '../../components/lecturer/OpenTopicModal';
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

export const LecturerGroupDetail = (): JSX.Element => {
  const { groupId: rawGroupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
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
      setMembersError(err instanceof Error ? err.message : t('lecturer.groupDetail.errMembersLoad'));
      setMembers([]);
    } finally {
      setIsMembersLoading(false);
    }
  }, [parsedGroupId, t]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  // `error` from the hook is intentionally ignored after the milestone
  // summary card was removed (Phase C); Phase progress surfaces its own
  // empty state via `reports.length === 0`.
  const {
    reports,
    isLoading: isReportsLoading,
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

  // Edit Group modal — the deadline input was removed because
  // per-phase deadlines (ConfigureMilestones / PhasedReport.deadlineAt)
  // are now the single source of truth. We stop sending `deadline`
  // entirely; the BE may still echo it back on the wire and we
  // deliberately ignore that value.
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [editGroupError, setEditGroupError] = useState<string | null>(null);

  // Open Topic modal — opens the shared `OpenTopicModal` component
  // (imported from `src/components/lecturer/OpenTopicModal.tsx`) which
  // shows an inline summary of the assigned topic: title, description,
  // and any reference material attached to it.
  const [openTopicModalOpen, setOpenTopicModalOpen] = useState<boolean>(false);

  const openEditModal = () => {
    if (!group) return;
    setEditName(typeof group.name === 'string' ? group.name : '');
    setEditDesc(typeof group.description === 'string' ? group.description : '');
    setEditGroupError(null);
    setEditNameError(null);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (isSavingGroup) return;
    setShowEditModal(false);
  };

  const handleEditGroupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!group || typeof group.id !== 'number') {
      setEditGroupError(t('lecturer.groupDetail.errMissingId'));
      return;
    }
    const trimmedName = editName.trim();
    const nameErr = trimmedName ? null : t('lecturer.groupDetail.errNameReq');
    setEditNameError(nameErr);
    if (nameErr) return;
    setIsSavingGroup(true);
    setEditGroupError(null);
    try {
      await researchGroupService.update(group.id, {
        lecturerId: group.lecturerId ?? null,
        topicId: group.topicId ?? null,
        name: trimmedName,
        description: editDesc.trim() || null,
        // The FE no longer collects or edits the group-level
        // `deadline` — per-phase deadlines own scheduling from
        // ConfigureMilestones. We still send the field because
        // `ResearchGroupUpdateRequest` keeps `deadline` required on
        // the wire; passing `null` here signals "no group-level
        // deadline" to the BE without us having to echo stale data.
        deadline: null,
        assignedAt: group.assignedAt ?? null,
      });
      setShowEditModal(false);
      setBanner({
        visible: true,
        text: t('lecturer.groupDetail.savedSuccess').replace('{name}', trimmedName),
        variant: 'success',
      });
      await refetchGroups();
    } catch (err) {
      setEditGroupError(
        err instanceof Error
          ? err.message
          : t('lecturer.groupDetail.errSaveUpdate'),
      );
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Invite students modal — 3x3 card grid with search + pagination
  // (Phase C). The current invite flow uses a textarea for raw
  // emails; we now fetch a roster of Graduate-Student users from
  // /api/User and let the lecturer tick the cards they want to add.
  // The selected students are flattened to their emails right before
  // calling `researchGroupService.invite(...)`, which keeps the wire
  // contract untouched.
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [isInviting, setIsInviting] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState<string>('');
  const [invitePage, setInvitePage] = useState<number>(1);
  const [studentRoster, setStudentRoster] = useState<User[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  // `allMemberships` is filled while the modal is open and used to
  // derive "X other groups" counts per student. The lecturer's owned
  // groups come from `useResearchGroups()` so the intersection logic
  // matches the spec's "intersect client-side" requirement.
  const [allMemberships, setAllMemberships] = useState<GroupMember[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());

  const INVITE_PAGE_SIZE = 9;

  const studentOtherGroupCounts = useMemo(() => {
    const counts = new Map<number, number>();
    if (allMemberships.length === 0) return counts;
    const lecturerGroupIds = new Set<number>();
    for (const g of groups) {
      if (typeof g.id === 'number') lecturerGroupIds.add(g.id);
    }
    const currentGroupId = parsedGroupId;
    for (const m of allMemberships) {
      if (typeof m.studentId !== 'number' || typeof m.researchGroupId !== 'number') continue;
      if (!lecturerGroupIds.has(m.researchGroupId)) continue;
      if (currentGroupId !== null && m.researchGroupId === currentGroupId) continue;
      counts.set(m.studentId, (counts.get(m.studentId) ?? 0) + 1);
    }
    return counts;
  }, [allMemberships, groups, parsedGroupId]);

  const memberStudentIds = useMemo(() => {
    const ids = new Set<number>();
    for (const m of members) {
      if (typeof m.studentId === 'number') ids.add(m.studentId);
    }
    return ids;
  }, [members]);

  const filteredStudents = useMemo(() => {
    const needle = inviteSearch.trim().toLowerCase();
    if (!needle) return studentRoster;
    return studentRoster.filter((s) => {
      const name = (s.fullName ?? '').toLowerCase();
      const email = (s.email ?? '').toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [studentRoster, inviteSearch]);

  const totalInvitePages = Math.max(
    1,
    Math.ceil(filteredStudents.length / INVITE_PAGE_SIZE),
  );

  // Keep `invitePage` inside the valid window whenever the filtered
  // list shrinks (e.g. after a search). Without this guard the
  // pagination controls would render an empty page.
  useEffect(() => {
    if (invitePage > totalInvitePages) setInvitePage(totalInvitePages);
  }, [invitePage, totalInvitePages]);

  const paginatedStudents = useMemo(() => {
    const start = (invitePage - 1) * INVITE_PAGE_SIZE;
    return filteredStudents.slice(start, start + INVITE_PAGE_SIZE);
  }, [filteredStudents, invitePage]);

  const selectedStudents = useMemo<User[]>(() => {
    return studentRoster.filter((s) => selectedStudentIds.has(s.id));
  }, [studentRoster, selectedStudentIds]);

  const loadRosterAndMemberships = useCallback(async () => {
    setIsLoadingRoster(true);
    setRosterError(null);
    try {
      const [usersRes, membershipsRes] = await Promise.allSettled([
        // BE filter — the lecturer console treats role=GraduateStudent
        // as the canonical roster key. If the BE ignores the query
        // param, we still narrow to GraduateStudent on the FE because
        // the page must never show admin / lecturer profiles.
        api.get('/api/User', { params: { role: 'GraduateStudent' } }),
        groupMemberService.getAll(),
      ]);

      const userPayload = usersRes.status === 'fulfilled' ? usersRes.value?.data : null;
      const userList: User[] = Array.isArray(userPayload)
        ? (userPayload as User[])
        : Array.isArray(userPayload?.items)
          ? (userPayload.items as User[])
          : [];
      const graduateStudents = userList.filter((u) => {
        const roleName = (u.roleName ?? '').toLowerCase();
        const roleId = typeof u.roleId === 'number' ? u.roleId : -1;
        return (
          roleName === 'graduate student' ||
          roleName === 'graduatestudent' ||
          roleId === 5 /* ROLE_IDS.GraduateStudent */
        );
      });
      setStudentRoster(graduateStudents);

      setAllMemberships(
        membershipsRes.status === 'fulfilled'
          ? (membershipsRes.value as GroupMember[])
          : [],
      );
    } catch (err) {
      setRosterError(
        err instanceof Error ? err.message : t('lecturer.groupDetail.errInviteFail'),
      );
      setStudentRoster([]);
      setAllMemberships([]);
    } finally {
      setIsLoadingRoster(false);
    }
  }, [t]);

  // Re-load every time the modal becomes visible. The hook below also
  // fires on initial mount (modal closed), but the data already in
  // state stays usable so we don't refetch on every prop change.
  // `loadRosterAndMemberships` is intentionally NOT in the deps array
  // because it would be re-created whenever `t` changes (the function
  // is rebuilt on every i18n refresh). We only want to re-fire when
  // the modal toggles open/closed.
  const loadRosterRef = useRef(loadRosterAndMemberships);
  loadRosterRef.current = loadRosterAndMemberships;
  useEffect(() => {
    if (!showInviteModal) return;
    void loadRosterRef.current();
  }, [showInviteModal]);

  const openInviteModal = () => {
    if (members.length >= 4) {
      setInviteError(t('lecturer.groupDetail.errMaxMembers'));
      return;
    }
    setSelectedStudentIds(new Set());
    setInviteSearch('');
    setInvitePage(1);
    setInviteError(null);
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    if (isInviting) return;
    setShowInviteModal(false);
  };

  const toggleStudentInvite = (student: User) => {
    if (memberStudentIds.has(student.id)) return;
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(student.id)) next.delete(student.id);
      else next.add(student.id);
      return next;
    });
  };

  const handleInviteStudents = async (e: FormEvent) => {
    e.preventDefault();
    if (parsedGroupId === null) return;
    const selected = studentRoster.filter((s) => selectedStudentIds.has(s.id));
    const emails = selected
      .map((s) => (typeof s.email === 'string' ? s.email.trim() : ''))
      .filter((mail) => mail.length > 0);
    const slotsLeft = Math.max(0, 4 - members.length);
    if (emails.length === 0) {
      setInviteError(t('lecturer.groupDetail.errNoEmail'));
      return;
    }
    if (emails.length > slotsLeft) {
      setInviteError(t('lecturer.groupDetail.errInviteMax').replace('{count}', String(slotsLeft)));
      return;
    }
    setIsInviting(true);
    setInviteError(null);
    try {
      const res = await researchGroupService.invite(parsedGroupId, emails);
      setShowInviteModal(false);
      setSelectedStudentIds(new Set());
      const successCount = res.successEmails?.length ?? res.totalInvited ?? 0;
      const notFoundCount = res.notFoundEmails?.length ?? 0;
      let msg = t('lecturer.groupDetail.inviteSuccess').replace('{count}', String(successCount));
      if (notFoundCount > 0) {
        msg += t('lecturer.groupDetail.inviteNotFound')
          .replace('{count}', String(notFoundCount))
          .replace('{emails}', res.notFoundEmails?.join(', ') ?? '');
      }
      setBanner({ visible: true, text: msg, variant: 'success' });
      await loadMembers();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = e?.response?.status;
      setInviteError(
        status === 401
          ? t('lecturer.groupDetail.errSessionExpired')
          : status === 403
            ? t('lecturer.groupDetail.errInviteDeny')
            : e?.response?.data?.message || e?.message || t('lecturer.groupDetail.errInviteFail'),
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
      const currentName = currentLeader.studentName || `${t('lecturer.groupDetail.studentPrefix')}${currentLeader.studentId ?? currentLeader.id}`;
      const nextName = member.studentName || `${t('lecturer.groupDetail.studentPrefix')}${member.studentId ?? member.id}`;
      if (!window.confirm(t('lecturer.groupDetail.confirmReplaceLeader').replace('{current}', currentName).replace('{next}', nextName))) return;
    }
    setLeaderActionLoading(memberId);
    try {
      await groupMemberService.setLeader(memberId, member.studentId ?? undefined);
      setBanner({
        visible: true,
        text: t('lecturer.groupDetail.setLeaderSuccess').replace('{name}', member.studentName || `${t('lecturer.groupDetail.studentPrefix')}${member.studentId}`),
        variant: 'success',
      });
      await loadMembers();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = e?.response?.status;
      const msg = status === 401
        ? t('lecturer.groupDetail.errSessionExpired')
        : status === 403
          ? t('lecturer.groupDetail.errLeaderDeny')
          : e?.response?.data?.message || e?.message || t('lecturer.groupDetail.errLeaderFail');
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
        text: t('lecturer.groupDetail.removeLeaderSuccess').replace('{name}', member.studentName || `${t('lecturer.groupDetail.studentPrefix')}${member.studentId}`),
        variant: 'success',
      });
      await loadMembers();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = e?.response?.status;
      const msg = status === 401
        ? t('lecturer.groupDetail.errSessionExpired')
        : status === 403
          ? t('lecturer.groupDetail.errLeaderDeny')
          : e?.response?.data?.message || e?.message || t('lecturer.groupDetail.errRemoveLeaderFail');
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
            {t('lecturer.groupDetail.missingParam')}
            <Link to={ROUTES.RESEARCH_GROUP}>{t('lecturer.groupDetail.breadcrumbParent')}</Link>.
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
          {t('lecturer.groupDetail.loadingGroup')}
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
            {t('lecturer.groupDetail.noGroupFound').replace('{id}', String(parsedGroupId))}
          </span>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={() => void refetchGroups()}>
          <RefreshCw size={14} aria-hidden /> {t('lecturer.groupDetail.retry')}
        </button>
        <button type="button" className={styles.backBtn} onClick={() => navigate(ROUTES.RESEARCH_GROUP)}>
          <ArrowLeft size={14} aria-hidden /> {t('lecturer.groupDetail.backToGroups')}
        </button>
      </div>
    );
  }

  const groupName = group.name ?? `Group #${group.id ?? '—'}`;

  return (
    <div className={styles.root} data-testid="lecturer-group-detail">
      {/* Breadcrumb — "Research Groups > [Group Name]" so the lecturer
          always knows their location in the hierarchy. */}
      <div className={styles.breadcrumb}>
        <Link to={ROUTES.RESEARCH_GROUP}>{t('lecturer.groupDetail.breadcrumbParent')}</Link>
        <span className={styles.breadcrumbSep} aria-hidden>/</span>
        <span className={styles.breadcrumbCurrent} title={groupName}>
          {groupName}
        </span>
      </div>

      {/* Page header — title + subtitle left, status + actions right */}
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitleBlock}>
            <h1 className={styles.pageTitle}>{groupName}</h1>
            <span className={styles.pageSubtitle}>
              Research Group #{group.id ?? '—'} · {t('lecturer.groupDetail.owner')} {ownerName}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <StatusBadge status={derivedStatus} />
          <button type="button" className={styles.editGroupBtn} onClick={openEditModal}>
            <Pencil size={14} aria-hidden />
            {t('lecturer.groupDetail.editGroup')}
          </button>
          <button type="button" className={styles.refreshBtn} onClick={() => void handleRefreshAll()}>
            <RefreshCw size={14} aria-hidden />
            {t('lecturer.groupDetail.refresh')}
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
          <span>{t('lecturer.groupDetail.metadataError')} {groupsError.message}</span>
          <button type="button" className={styles.retryBtn} onClick={() => void refetchGroups()}>
            {t('lecturer.groupDetail.retry')}
          </button>
        </div>
      )}

      {/* Metadata strip — note that the group-level `deadline` is no
          longer surfaced here or in the Edit Group modal. Per-phase
          deadlines now live exclusively inside `ConfigureMilestones`
          (see PageTimelineItem.deadline derived from the live PhasedReport
          API and configured by PhasedReportUpdateRequest.deadlineAt). The
          BE still returns `group.deadline` on the wire for backwards
          compatibility, but the FE has stopped rendering and persisting it
          so we can phase the column out cleanly. */}
      <section className={styles.metaStrip}>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <Clock size={12} aria-hidden /> {t('lecturer.groupDetail.assignedAt')}
          </span>
          <span className={styles.metaValue}>{formatDateTime(group.assignedAt ?? null)}</span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <Users size={12} aria-hidden /> {t('lecturer.groupDetail.members')}
          </span>
          <span className={styles.metaValue}>
            {members.length}{isMembersLoading ? ` (${t('common.loading')})` : ''}
          </span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>
            <FileText size={12} aria-hidden /> {t('lecturer.groupDetail.phasedReports')}
          </span>
          <span className={styles.metaValue}>
            {reports.length}{isReportsLoading ? ` (${t('common.loading')})` : ''}
          </span>
        </div>
      </section>

      {/* Section cards — 2-column grid on desktop, 1-column on mobile.
          Row 1: Assigned topic + Group members
          Row 2: Phase progress (alone — Milestone summary was removed)
          Row 3: Learning materials (full width) */}
      <div className={styles.cardsGrid}>

        {/* Assigned topic */}
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>{t('lecturer.groupDetail.assignedTopic')}</h2>
            <span className={styles.cardHint}>
              {t('lecturer.groupDetail.topicHint')}
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
                <button
                  type="button"
                  className={styles.openLink}
                  onClick={() => setOpenTopicModalOpen(true)}
                  data-testid="open-topic-button"
                >
                  <ExternalLink size={14} aria-hidden /> {t('lecturer.groupDetail.openTopic')}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.cardBody}>
              <div className={styles.emptyState}>
                {t('lecturer.groupDetail.noTopic')}{' '}
                <Link to={ROUTES.LECTURER_RESEARCH_TOPICS}>{t('lecturer.groupDetail.assignOne')}</Link>
              </div>
            </div>
          )}
        </section>

        {/* Group members */}
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.cardHeaderRow}>
              <h2 className={styles.cardTitle}>
                <Users size={16} aria-hidden /> {t('lecturer.groupDetail.groupMembersTitle')} ({members.length})
              </h2>
              <button
                type="button"
                className={styles.inviteStudentsBtn}
                onClick={openInviteModal}
                disabled={members.length >= 4 || isMembersLoading}
                title={members.length >= 4 ? t('lecturer.groupDetail.maxMembersReached') : t('lecturer.groupDetail.inviteStudents')}
              >
                <UserPlus size={14} aria-hidden /> {t('lecturer.groupDetail.inviteStudents')}
              </button>
            </div>
            <InlineNotice
              tone="info"
              title={t('lecturer.groupDetail.maxMembersNotice')}
              description={t('lecturer.groupDetail.maxMembersNoticeDesc')}
            />
            <span className={styles.cardHint}>
              {t('lecturer.groupDetail.membersHint')}
            </span>
          </header>
          {membersError && (
            <div className={styles.errorPanel} role="alert">
              <AlertTriangle size={14} aria-hidden />
              <span>{membersError}</span>
              <button type="button" className={styles.retryBtn} onClick={() => void loadMembers()}>
                {t('lecturer.groupDetail.retry')}
              </button>
            </div>
          )}
          {isMembersLoading ? (
            <div className={styles.loadingPanel}>
              <Loader size={14} className={styles.spinningIcon} aria-hidden />
              {t('lecturer.groupDetail.loadingMembers')}
            </div>
          ) : members.length === 0 ? (
            <div className={styles.emptyState}>
              <Users size={18} aria-hidden />
              {t('lecturer.groupDetail.noStudents')}
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
                            {m.studentName || `${t('lecturer.groupDetail.studentPrefix')}${m.studentId ?? mid}`}
                          </span>
                          {m.isLeader && (
                            <span className={styles.leaderBadge}>
                              <Crown size={12} aria-hidden />
                              {t('lecturer.groupDetail.leaderRole')}
                            </span>
                          )}
                        </div>
                        <div className={styles.memberMeta}>
                          {m.studentEmail && <span>{m.studentEmail}</span>}
                          <span>
                            {t('lecturer.groupDetail.status')} <strong>{m.activityStatus ?? t('lecturer.groupDetail.joined')}</strong>
                          </span>
                          <span>{t('lecturer.groupDetail.joined')} {formatDateOnly(m.joinedAt ?? null)}</span>
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
                          {t('lecturer.groupDetail.removeLeader')}
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
                          {t('lecturer.groupDetail.assignLeader')}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Phase progress */}
        {phaseTimelineItems.length > 0 && (
          <section className={styles.card} aria-labelledby="phaseProgressTitle">
            <header className={styles.cardHeader}>
              <h2 id="phaseProgressTitle" className={styles.cardTitle}>
                {t('lecturer.groupDetail.phaseProgressTitle')}
              </h2>
              <span className={styles.cardHint}>
                {t('lecturer.groupDetail.phaseProgressHint')}
              </span>
            </header>
            <div className={styles.cardBody}>
              <PhaseTimeline items={phaseTimelineItems} />
            </div>
          </section>
        )}

        {/* Milestone summary card was intentionally removed in Phase C — the
            deadline / milestone ownership moved into per-phase deadlines on
            `ConfigureMilestones`. Phase progress continues to surface via
            the `<PhaseTimeline />` card above. */}

        {/* Learning materials — full width */}
        <section className={`${styles.card} ${styles.cardFull}`}>
          <header className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              <Library size={16} aria-hidden /> {t('lecturer.groupDetail.learningMaterialsTitle')}
            </h2>
            <span className={styles.cardHint}>
              {t('lecturer.groupDetail.learningMaterialsHint')}
            </span>
          </header>
          {materialsError && (
            <div className={styles.errorPanel} role="alert">
              <AlertTriangle size={14} aria-hidden />
              <span>{materialsError.message}</span>
              <button type="button" className={styles.retryBtn} onClick={() => void refetchMaterials()}>
                {t('lecturer.groupDetail.retry')}
              </button>
            </div>
          )}
          {isMaterialsLoading ? (
            <div className={styles.loadingPanel}>
              <Loader size={14} className={styles.spinningIcon} aria-hidden />
              {t('lecturer.groupDetail.loadingMaterials')}
            </div>
          ) : materials.length === 0 ? (
            <div className={styles.emptyState}>
              <Library size={18} aria-hidden />
              {t('lecturer.groupDetail.noMaterials')}
            </div>
          ) : (
            <ul className={styles.materialList}>
              {materials.map((m) => {
                const id = typeof m.id === 'number' ? m.id : -1;
                const title = (m.title ?? '').trim() || `${t('lecturer.groupDetail.materialPrefix')}${id}`;
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
                        {t('lecturer.groupDetail.open')}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </div>

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
                  <h3 className={styles.modalTitle}>{t('lecturer.groupDetail.editModalTitle')}</h3>
                  <span className={styles.modalSubtitle}>{groupName}</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeEditModal}
                disabled={isSavingGroup}
                aria-label={t('common.cancel')}
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
                  * {t('lecturer.groupDetail.groupNameLabel')}
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
                  {t('lecturer.groupDetail.descriptionLabel')}
                </label>
                <textarea
                  id="groupDesc"
                  className={styles.formTextarea}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                />
                <span className={styles.cardHint}>
                  {t('lecturer.groupDetail.deadlineRemovedHint')}
                </span>
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
                {t('lecturer.groupDetail.cancel')}
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
                {isSavingGroup ? t('lecturer.groupDetail.saving') : t('lecturer.groupDetail.saveGroup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Students modal (3x3 card grid) ─────────────── */}
      {showInviteModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="inviteStudentsTitle">
          <div className={`${styles.modal} ${styles.inviteModal}`}>
            <header className={styles.modalHeader}>
              <h2 id="inviteStudentsTitle" className={styles.modalTitle}>
                <UserPlus size={18} aria-hidden />
                {t('lecturer.groupDetail.inviteModalTitle')}
              </h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={closeInviteModal}
                disabled={isInviting}
                aria-label={t('common.cancel')}
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
              {/* Search bar */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="inviteSearch">
                  <Search size={12} aria-hidden /> {t('lecturer.groupDetail.inviteSearchLabel')}
                </label>
                <input
                  id="inviteSearch"
                  type="search"
                  className={styles.formInput}
                  value={inviteSearch}
                  onChange={(e) => {
                    setInviteSearch(e.target.value);
                    setInvitePage(1);
                  }}
                  placeholder={t('lecturer.groupDetail.inviteSearchPlaceholder')}
                  disabled={isInviting}
                />
              </div>

              {/* Card grid: 3 columns on desktop, 1 on mobile.
                  Each card lists the student plus the count of OTHER
                  groups they already belong to (intersected with this
                  lecturer's groups via useResearchGroups). */}
              <div className={styles.inviteCardGrid}>
                {isLoadingRoster && (
                  <div className={`${styles.inviteGridState} ${styles.inviteGridStateWide}`}>
                    <Loader size={14} className={styles.spinningIcon} aria-hidden />
                    {t('lecturer.groupDetail.inviteLoadingStudents')}
                  </div>
                )}
                {!isLoadingRoster && rosterError && (
                  <div className={`${styles.errorPanel} ${styles.inviteGridStateWide}`} role="alert">
                    <AlertTriangle size={14} aria-hidden />
                    <span>{rosterError}</span>
                    <button
                      type="button"
                      className={styles.retryBtn}
                      onClick={() => void loadRosterAndMemberships()}
                    >
                      {t('lecturer.groupDetail.retry')}
                    </button>
                  </div>
                )}
                {!isLoadingRoster && !rosterError && filteredStudents.length === 0 && (
                  <div className={styles.inviteGridState}>
                    {inviteSearch.trim()
                      ? t('lecturer.groupDetail.inviteNoStudentsFound')
                      : t('lecturer.groupDetail.inviteEmptyState')}
                  </div>
                )}
                {!isLoadingRoster && !rosterError && paginatedStudents.map((student) => {
                  const alreadyInGroup = memberStudentIds.has(student.id);
                  const otherCount = studentOtherGroupCounts.get(student.id) ?? 0;
                  const isSelected = selectedStudentIds.has(student.id);
                  return (
                    <article
                      key={`invite-${student.id}`}
                      className={`${styles.inviteCard} ${isSelected ? styles.inviteCardSelected : ''} ${alreadyInGroup ? styles.inviteCardDisabled : ''}`}
                      aria-disabled={alreadyInGroup}
                    >
                      <div className={styles.inviteCardIdentity}>
                        <div className={styles.inviteCardAvatar} aria-hidden>
                          {student.fullName?.slice(0, 2).toUpperCase() ?? 'ST'}
                        </div>
                        <div className={styles.inviteCardBody}>
                          <div className={styles.inviteCardName}>
                            <span className={styles.inviteCardLabel}>
                              {t('lecturer.groupDetail.inviteCardFullName')}
                            </span>
                            <span className={styles.inviteCardNameValue}>
                              {student.fullName ?? `Student #${student.id}`}
                            </span>
                          </div>
                          <div className={styles.inviteCardEmail}>
                            <span className={styles.inviteCardLabel}>
                              {t('lecturer.groupDetail.inviteCardEmail')}
                            </span>
                            <span className={styles.inviteCardEmailValue}>
                              {student.email ?? '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.inviteCardGroups}>
                        <span className={styles.inviteCardLabel}>
                          {t('lecturer.groupDetail.inviteCardExistingGroups')}
                        </span>
                        <span className={styles.inviteCardGroupsValue}>
                          {alreadyInGroup
                            ? t('lecturer.groupDetail.inviteCardAlreadyInGroup')
                            : otherCount > 0
                              ? t('lecturer.groupDetail.inviteCardOtherGroups').replace('{count}', String(otherCount))
                              : t('lecturer.groupDetail.inviteCardNoOtherGroups')}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.inviteCardBtn}
                        onClick={() => toggleStudentInvite(student)}
                        disabled={alreadyInGroup || isInviting}
                        aria-pressed={isSelected}
                      >
                        {isSelected ? <X size={14} aria-hidden /> : <UserPlus size={14} aria-hidden />}
                        {alreadyInGroup
                          ? t('lecturer.groupDetail.inviteCardAlreadyInGroup')
                          : isSelected
                            ? t('lecturer.groupDetail.inviteRemoveFromPending')
                            : t('lecturer.groupDetail.inviteAction')}
                      </button>
                    </article>
                  );
                })}
              </div>

              {/* Pagination */}
              {filteredStudents.length > INVITE_PAGE_SIZE && (
                <nav className={styles.invitePagination} aria-label="invite pagination">
                  <button
                    type="button"
                    className={styles.invitePageBtn}
                    onClick={() => setInvitePage((p) => Math.max(1, p - 1))}
                    disabled={invitePage === 1 || isInviting}
                    aria-label={t('lecturer.groupDetail.invitePrevPage')}
                  >
                    <ChevronLeft size={14} aria-hidden /> {t('lecturer.groupDetail.invitePrevPage')}
                  </button>
                  <span className={styles.invitePageIndicator}>
                    {t('lecturer.groupDetail.invitePageIndicator')
                      .replace('{page}', String(invitePage))
                      .replace('{total}', String(totalInvitePages))}
                  </span>
                  <button
                    type="button"
                    className={styles.invitePageBtn}
                    onClick={() => setInvitePage((p) => Math.min(totalInvitePages, p + 1))}
                    disabled={invitePage === totalInvitePages || isInviting}
                    aria-label={t('lecturer.groupDetail.inviteNextPage')}
                  >
                    {t('lecturer.groupDetail.inviteNextPage')} <ChevronRight size={14} aria-hidden />
                  </button>
                </nav>
              )}

              {/* Pending invite summary at the bottom of the form */}
              {selectedStudents.length > 0 && (
                <div className={styles.invitePendingList}>
                  <span className={styles.invitePendingTitle}>
                    {t('lecturer.groupDetail.invitePendingTitle')
                      .replace('{count}', String(selectedStudents.length))}
                  </span>
                  <ul className={styles.invitePendingChips}>
                    {selectedStudents.map((s) => (
                      <li key={`pending-${s.id}`} className={styles.invitePendingChip}>
                        <span>{s.fullName ?? `Student #${s.id}`}</span>
                        <button
                          type="button"
                          className={styles.invitePendingRemove}
                          onClick={() => toggleStudentInvite(s)}
                          disabled={isInviting}
                          aria-label={t('lecturer.groupDetail.inviteRemoveFromPending')}
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedStudents.length === 0 && (
                <span className={styles.cardHint}>
                  {t('lecturer.groupDetail.invitePendingEmpty')}
                </span>
              )}

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
                {t('lecturer.groupDetail.cancel')}
              </button>
              <button
                type="submit"
                form="invite-students-form"
                className={styles.primaryBtn}
                disabled={isInviting || selectedStudentIds.size === 0 || members.length >= 4}
                data-testid="send-invites-btn"
              >
                {isInviting
                  ? <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  : <Check size={14} aria-hidden />}
                {isInviting
                  ? t('lecturer.groupDetail.sendingInvites')
                  : `${t('lecturer.groupDetail.sendInvitations')} (${selectedStudentIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Open Topic modal ─────────────────────────────────── */}
      <OpenTopicModal
        isOpen={openTopicModalOpen}
        topic={
          relatedTopic
            ? {
                title: relatedTopic.title ?? `Topic #${relatedTopic.id}`,
                description: relatedTopic.description,
                material: relatedTopic.materialsUrl
                  ? relatedTopic.materialsUrl.startsWith('http')
                    ? { kind: 'url', url: relatedTopic.materialsUrl }
                    : { kind: 'url', url: relatedTopic.materialsUrl }
                  : null,
              }
            : null
        }
        currentLecturerId={lecturerId}
        onClose={() => setOpenTopicModalOpen(false)}
      />
    </div>
  );
};

export default LecturerGroupDetail;

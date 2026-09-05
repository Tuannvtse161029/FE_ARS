/**
 * GroupMembership — members list and invite management
 *
 * Extracted from src/pages/Lecturer/GroupDetail.tsx
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Loader,
  AlertTriangle,
  Users,
  UserPlus,
  Crown,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import api from '../../../services/axios';
import type { User } from '../../../types/auth';
import { groupMemberService, type GroupMember } from '../../../services/groupMember.service';
import { InlineNotice } from '../../../components/InlineNotice/InlineNotice';
import { researchGroupService } from '../../../services/researchGroup.service';
import type { ResearchGroup } from '../../../services/researchGroup.service';
// CSS module kept at the original GroupDetail CSS location for now.
import styles from '../../pages/Lecturer/GroupDetail.module.css';

export interface GroupMembershipProps {
  members: GroupMember[];
  isLoading: boolean;
  error: string | null;
  membersCount: number;
  onLoadMembers: () => Promise<void>;
  onShowInvite: () => void;
  onSetLeader: (member: GroupMember) => Promise<void>;
  onRemoveLeader: (member: GroupMember) => Promise<void>;
  leaderActionLoading: number | null;
  showInviteModal: boolean;
  onCloseInvite: () => void;
  parsedGroupId: number;
  onInviteSuccess: (message: string) => Promise<void>;
  lecturerGroups: ResearchGroup[];
}

const INVITE_PAGE_SIZE = 9;

export const GroupMembership: React.FC<GroupMembershipProps> = ({
  members,
  isLoading,
  error,
  membersCount,
  onLoadMembers,
  onShowInvite,
  onSetLeader,
  onRemoveLeader,
  leaderActionLoading,
  showInviteModal,
  onCloseInvite,
  parsedGroupId,
  onInviteSuccess,
  lecturerGroups,
}) => {
  const { t } = useI18n();
  const [isInviting, setIsInviting] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState<string>('');
  const [invitePage, setInvitePage] = useState<number>(1);
  const [studentRoster, setStudentRoster] = useState<User[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState<boolean>(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [allMemberships, setAllMemberships] = useState<GroupMember[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());

  const studentOtherGroupCounts = useMemo(() => {
    const counts = new Map<number, number>();
    if (allMemberships.length === 0) return counts;
    const lecturerGroupIds = new Set<number>();
    for (const g of lecturerGroups) {
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
  }, [allMemberships, lecturerGroups, parsedGroupId]);

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

  const totalInvitePages = Math.max(1, Math.ceil(filteredStudents.length / INVITE_PAGE_SIZE));

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
        api.get('/api/User', { params: { role: 'GraduateStudent' } }),
        groupMemberService.getAll(),
      ]);

      const userPayload = usersRes.status === 'fulfilled' ? usersRes.value?.data : null;
      const userList: User[] = Array.isArray(userPayload)
        ? (userPayload as User[])
        : Array.isArray(userPayload?.items) ? (userPayload.items as User[]) : [];
      const graduateStudents = userList.filter((u) => {
        const roleName = (u.roleName ?? '').toLowerCase();
        const roleId = typeof u.roleId === 'number' ? u.roleId : -1;
        return (
          roleName === 'graduate student' ||
          roleName === 'graduatestudent' ||
          roleId === 5
        );
      });
      setStudentRoster(graduateStudents);

      setAllMemberships(
        membershipsRes.status === 'fulfilled' ? (membershipsRes.value as GroupMember[]) : [],
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

  const loadRosterRef = useRef(loadRosterAndMemberships);
  loadRosterRef.current = loadRosterAndMemberships;
  useEffect(() => {
    if (!showInviteModal) return;
    void loadRosterRef.current();
  }, [showInviteModal]);

  const handleShowInvite = () => {
    if (members.length >= 4) {
      onShowInvite();
      return;
    }
    setSelectedStudentIds(new Set());
    setInviteSearch('');
    setInvitePage(1);
    setInviteError(null);
    onShowInvite();
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
      setSelectedStudentIds(new Set());
      const successCount = res.successEmails?.length ?? res.totalInvited ?? 0;
      const notFoundCount = res.notFoundEmails?.length ?? 0;
      let msg = t('lecturer.groupDetail.inviteSuccess').replace('{count}', String(successCount));
      if (notFoundCount > 0) {
        msg += t('lecturer.groupDetail.inviteNotFound')
          .replace('{count}', String(notFoundCount))
          .replace('{emails}', res.notFoundEmails?.join(', ') ?? '');
      }
      await onInviteSuccess(msg);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = e?.response?.status;
      setInviteError(
        status === 401 ? t('lecturer.groupDetail.errSessionExpired') :
        status === 403 ? t('lecturer.groupDetail.errInviteDeny') :
        e?.response?.data?.message || e?.message || t('lecturer.groupDetail.errInviteFail'),
      );
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.cardTitle}>
            <Users size={16} aria-hidden /> {t('lecturer.groupDetail.groupMembersTitle')} ({members.length})
          </h2>
          <button
            type="button"
            className={styles.inviteStudentsBtn}
            onClick={handleShowInvite}
            disabled={members.length >= 4 || isLoading}
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
        <span className={styles.cardHint}>{t('lecturer.groupDetail.membersHint')}</span>
      </header>

      {error && (
        <div className={styles.errorPanel} role="alert">
          <AlertTriangle size={14} aria-hidden />
          <span>{error}</span>
          <button type="button" className={styles.retryBtn} onClick={() => void onLoadMembers()}>
            {t('lecturer.groupDetail.retry')}
          </button>
        </div>
      )}
      {isLoading ? (
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
          {members.map((m) => {
            const mid = typeof m.id === 'number' ? m.id : -1;
            const isBusy = leaderActionLoading === mid;
            const initials = (m.studentName ?? '').trim().slice(0, 2).toUpperCase() || 'ST';
            return (
              <li key={`member-${mid}`} className={styles.memberRow}>
                <div className={styles.memberIdentity}>
                  <div className={`${styles.memberAvatar} ${m.isLeader ? styles.memberAvatarLeader : ''}`} aria-hidden>
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
                      <span>{t('lecturer.groupDetail.status')} <strong>{m.activityStatus ?? t('lecturer.groupDetail.joined')}</strong></span>
                      <span>{t('lecturer.groupDetail.joined')} {(m.joinedAt ? new Date(m.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—')}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.memberActions}>
                  {m.isLeader ? (
                    <button
                      type="button"
                      className={styles.removeLeaderBtn}
                      onClick={() => void onRemoveLeader(m)}
                      disabled={isBusy}
                    >
                      {isBusy ? <Loader size={12} className={styles.spinningIcon} aria-hidden /> : <X size={14} aria-hidden />}
                      {t('lecturer.groupDetail.removeLeader')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.setLeaderBtn}
                      onClick={() => void onSetLeader(m)}
                      disabled={isBusy}
                    >
                      {isBusy ? <Loader size={12} className={styles.spinningIcon} aria-hidden /> : <Crown size={14} className={styles.leaderCrown} aria-hidden />}
                      {t('lecturer.groupDetail.assignLeader')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="inviteStudentsTitle">
          <div className={`${styles.modal} ${styles.inviteModal}`}>
            <header className={styles.modalHeader}>
              <h2 id="inviteStudentsTitle" className={styles.modalTitle}>
                <UserPlus size={18} aria-hidden />
                {t('lecturer.groupDetail.inviteModalTitle')}
              </h2>
              <button type="button" className={styles.modalCloseBtn} onClick={onCloseInvite} disabled={isInviting} aria-label={t('common.cancel')}>
                <X size={16} aria-hidden />
              </button>
            </header>

            <form id="invite-students-form" onSubmit={handleInviteStudents} className={styles.modalForm} noValidate>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="inviteSearch">
                  <Search size={12} aria-hidden /> {t('lecturer.groupDetail.inviteSearchLabel')}
                </label>
                <input
                  id="inviteSearch"
                  type="search"
                  className={styles.formInput}
                  value={inviteSearch}
                  onChange={(e) => { setInviteSearch(e.target.value); setInvitePage(1); }}
                  placeholder={t('lecturer.groupDetail.inviteSearchPlaceholder')}
                  disabled={isInviting}
                />
              </div>

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
                    <button type="button" className={styles.retryBtn} onClick={() => void loadRosterAndMemberships()}>
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
                            <span className={styles.inviteCardLabel}>{t('lecturer.groupDetail.inviteCardFullName')}</span>
                            <span className={styles.inviteCardNameValue}>{student.fullName ?? `Student #${student.id}`}</span>
                          </div>
                          <div className={styles.inviteCardEmail}>
                            <span className={styles.inviteCardLabel}>{t('lecturer.groupDetail.inviteCardEmail')}</span>
                            <span className={styles.inviteCardEmailValue}>{student.email ?? '—'}</span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.inviteCardGroups}>
                        <span className={styles.inviteCardLabel}>{t('lecturer.groupDetail.inviteCardExistingGroups')}</span>
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

              {filteredStudents.length > INVITE_PAGE_SIZE && (
                <nav className={styles.invitePagination} aria-label="invite pagination">
                  <button type="button" className={styles.invitePageBtn} onClick={() => setInvitePage((p) => Math.max(1, p - 1))} disabled={invitePage === 1 || isInviting} aria-label={t('lecturer.groupDetail.invitePrevPage')}>
                    <ChevronLeft size={14} aria-hidden /> {t('lecturer.groupDetail.invitePrevPage')}
                  </button>
                  <span className={styles.invitePageIndicator}>
                    {t('lecturer.groupDetail.invitePageIndicator')
                      .replace('{page}', String(invitePage))
                      .replace('{total}', String(totalInvitePages))}
                  </span>
                  <button type="button" className={styles.invitePageBtn} onClick={() => setInvitePage((p) => Math.min(totalInvitePages, p + 1))} disabled={invitePage === totalInvitePages || isInviting} aria-label={t('lecturer.groupDetail.inviteNextPage')}>
                    {t('lecturer.groupDetail.inviteNextPage')} <ChevronRight size={14} aria-hidden />
                  </button>
                </nav>
              )}

              {selectedStudents.length > 0 && (
                <div className={styles.invitePendingList}>
                  <span className={styles.invitePendingTitle}>
                    {t('lecturer.groupDetail.invitePendingTitle').replace('{count}', String(selectedStudents.length))}
                  </span>
                  <ul className={styles.invitePendingChips}>
                    {selectedStudents.map((s) => (
                      <li key={`pending-${s.id}`} className={styles.invitePendingChip}>
                        <span>{s.fullName ?? `Student #${s.id}`}</span>
                        <button type="button" className={styles.invitePendingRemove} onClick={() => toggleStudentInvite(s)} disabled={isInviting} aria-label={t('lecturer.groupDetail.inviteRemoveFromPending')}>
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
              <button type="button" className={styles.cancelBtn} onClick={onCloseInvite} disabled={isInviting}>
                {t('lecturer.groupDetail.cancel')}
              </button>
              <button
                type="submit"
                form="invite-students-form"
                className={styles.primaryBtn}
                disabled={isInviting || selectedStudentIds.size === 0 || membersCount >= 4}
                data-testid="send-invites-btn"
              >
                {isInviting ? <Loader size={14} className={styles.spinningIcon} aria-hidden /> : <Check size={14} aria-hidden />}
                {isInviting
                  ? t('lecturer.groupDetail.sendingInvites')
                  : `${t('lecturer.groupDetail.sendInvitations')} (${selectedStudentIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default GroupMembership;

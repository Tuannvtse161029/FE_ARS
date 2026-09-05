/**
 * GroupDetail — Lecturer-facing research group detail page
 *
 * Refactored from src/pages/Lecturer/GroupDetail.tsx
 * Uses extracted components:
 *   - GroupPhases (phase timeline)
 *   - GroupMembership (members management)
 *   - MaterialsDisplay (learning materials)
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
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
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import { usePhasedReports } from '../../hooks/usePhasedReports';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import { useLecturerProfile } from '../../hooks/useLecturerProfile';
import { researchGroupService, deriveGroupStatus } from '../../services/researchGroup.service';
import type { ResearchGroup } from '../../services/researchGroup.service';
import { groupMemberService, type GroupMember } from '../../services/groupMember.service';
import { useResearchTopics } from '../../hooks/useResearchTopics';
import { StatusBadge } from '../../components/common/StatusBadge';
import { OpenTopicModal } from '../../components/lecturer/OpenTopicModal';
import { FieldError } from '../../components/FieldError';
import { GroupPhases } from './components/GroupPhases';
import { GroupMembership } from './components/GroupMembership';
import { MaterialsDisplay } from './components/MaterialsDisplay';
import { ROUTES } from '../../routes/paths';
// CSS module kept at the original GroupDetail CSS location for now.
import styles from '../../pages/Lecturer/GroupDetail.module.css';

interface BannerState {
  visible: boolean;
  text: string;
  variant: 'success' | 'error';
}

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
      return db - da;
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

  const ownerLecturerId =
    typeof group?.lecturerId === 'number' && group.lecturerId > 0
      ? group.lecturerId
      : null;
  const { displayName: ownerName } = useLecturerProfile(ownerLecturerId);

  // Banner state
  const [banner, setBanner] = useState<BannerState>({ visible: false, text: '', variant: 'success' });

  // Edit Group modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [editGroupError, setEditGroupError] = useState<string | null>(null);

  // Open Topic modal
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
        err instanceof Error ? err.message : t('lecturer.groupDetail.errSaveUpdate'),
      );
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Invite students modal
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
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
      const msg = status === 401 ? t('lecturer.groupDetail.errSessionExpired') : status === 403 ? t('lecturer.groupDetail.errLeaderDeny') : e?.response?.data?.message || e?.message || t('lecturer.groupDetail.errLeaderFail');
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
      const msg = status === 401 ? t('lecturer.groupDetail.errSessionExpired') : status === 403 ? t('lecturer.groupDetail.errLeaderDeny') : e?.response?.data?.message || e?.message || t('lecturer.groupDetail.errRemoveLeaderFail');
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
          <span>{t('lecturer.groupDetail.noGroupFound').replace('{id}', String(parsedGroupId))}</span>
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
      <div className={styles.breadcrumb}>
        <Link to={ROUTES.RESEARCH_GROUP}>{t('lecturer.groupDetail.breadcrumbParent')}</Link>
        <span className={styles.breadcrumbSep} aria-hidden>/</span>
        <span className={styles.breadcrumbCurrent} title={groupName}>{groupName}</span>
      </div>

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

      {banner.visible && (
        <div className={`${styles.banner} ${banner.variant === 'success' ? styles.bannerSuccess : styles.bannerError}`} role="status">
          <span className={styles.bannerIcon}>
            {banner.variant === 'success' ? <CheckCircle2 size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
          </span>
          <span className={styles.bannerText}>{banner.text}</span>
          <button type="button" className={styles.bannerCloseBtn} onClick={() => setBanner({ visible: false, text: '', variant: 'success' })} aria-label="Dismiss">
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

      {/* Metadata strip */}
      <section className={styles.metaStrip}>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}><Clock size={12} aria-hidden /> {t('lecturer.groupDetail.assignedAt')}</span>
          <span className={styles.metaValue}>{formatDateTime(group.assignedAt ?? null)}</span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}><Users size={12} aria-hidden /> {t('lecturer.groupDetail.members')}</span>
          <span className={styles.metaValue}>{members.length}{isMembersLoading ? ` (${t('common.loading')})` : ''}</span>
        </div>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}><FileText size={12} aria-hidden /> {t('lecturer.groupDetail.phasedReports')}</span>
          <span className={styles.metaValue}>{reports.length}{isReportsLoading ? ` (${t('common.loading')})` : ''}</span>
        </div>
      </section>

      <div className={styles.cardsGrid}>
        {/* Assigned topic */}
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>{t('lecturer.groupDetail.assignedTopic')}</h2>
            <span className={styles.cardHint}>{t('lecturer.groupDetail.topicHint')}</span>
          </header>
          {relatedTopic ? (
            <div className={styles.cardBody}>
              <div className={styles.cardInner}>
                <StatusBadge status={deriveGroupStatus(group, relatedTopic.status)} />
                <div className={styles.topicSummaryText}>
                  <strong className={styles.topicSummaryTitle}>{relatedTopic.title ?? `RT-${group.topicId}`}</strong>
                  {relatedTopic.description?.trim() && (
                    <span className={styles.topicSummaryDesc}>{relatedTopic.description}</span>
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

        {/* Group Membership */}
        <GroupMembership
          members={sortedMembers}
          isLoading={isMembersLoading}
          error={membersError}
          membersCount={members.length}
          onLoadMembers={loadMembers}
          onShowInvite={() => setShowInviteModal(true)}
          onSetLeader={handleSetLeader}
          onRemoveLeader={handleRemoveLeader}
          leaderActionLoading={leaderActionLoading}
          showInviteModal={showInviteModal}
          onCloseInvite={() => setShowInviteModal(false)}
          parsedGroupId={parsedGroupId}
          onInviteSuccess={async (message) => {
            setShowInviteModal(false);
            setBanner({ visible: true, text: message, variant: 'success' });
            await loadMembers();
          }}
          lecturerGroups={groups}
        />

        {/* Group Phases */}
        <GroupPhases reports={reports} />

        {/* Materials */}
        <MaterialsDisplay
          materials={materials}
          isLoading={isMaterialsLoading}
          error={materialsError}
          onRetry={() => void refetchMaterials()}
        />
      </div>

      {/* Edit Group modal */}
      {showEditModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}><Pencil size={18} aria-hidden /></span>
                <div>
                  <h3 className={styles.modalTitle}>{t('lecturer.groupDetail.editModalTitle')}</h3>
                  <span className={styles.modalSubtitle}>{groupName}</span>
                </div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={closeEditModal} disabled={isSavingGroup} aria-label={t('common.cancel')}>
                <X size={18} aria-hidden />
              </button>
            </div>

            <form id="edit-group-form" onSubmit={handleEditGroupSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="groupName">* {t('lecturer.groupDetail.groupNameLabel')}</label>
                <input
                  id="groupName"
                  type="text"
                  className={`${styles.formInput} ${editNameError ? styles.formInputError : ''}`}
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); if (editNameError) setEditNameError(null); }}
                  aria-invalid={Boolean(editNameError)}
                  aria-describedby={editNameError ? 'gd-group-name-error' : undefined}
                  required
                />
                <FieldError id="gd-group-name-error" message={editNameError} testId="gd-group-name-error" />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="groupDesc">{t('lecturer.groupDetail.descriptionLabel')}</label>
                <textarea id="groupDesc" className={styles.formTextarea} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
                <span className={styles.cardHint}>{t('lecturer.groupDetail.deadlineRemovedHint')}</span>
              </div>

              {editGroupError && (
                <div className={styles.errorPanel} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{editGroupError}</span>
                </div>
              )}
            </form>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.cancelBtn} onClick={closeEditModal} disabled={isSavingGroup}>
                {t('lecturer.groupDetail.cancel')}
              </button>
              <button type="submit" form="edit-group-form" className={styles.primaryBtn} disabled={isSavingGroup}>
                {isSavingGroup ? <Loader size={14} className={styles.spinningIcon} aria-hidden /> : <Check size={14} aria-hidden />}
                {isSavingGroup ? t('lecturer.groupDetail.saving') : t('lecturer.groupDetail.saveGroup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Topic modal */}
      <OpenTopicModal
        isOpen={openTopicModalOpen}
        topic={relatedTopic ? {
          title: relatedTopic.title ?? `Topic #${relatedTopic.id}`,
          description: relatedTopic.description,
          material: relatedTopic.materialsUrl ? { kind: 'url', url: relatedTopic.materialsUrl } : null,
        } : null}
        currentLecturerId={lecturerId}
        onClose={() => setOpenTopicModalOpen(false)}
      />
    </div>
  );
};

export default LecturerGroupDetail;

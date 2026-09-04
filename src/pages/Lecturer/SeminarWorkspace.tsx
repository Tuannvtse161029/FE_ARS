import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  Check,
  X,
  Loader,
  FileText,
  Inbox,
  Calendar,
  Clock,
  Video,
  Eye,
  ClipboardList,
  Mail,
  AlertTriangle,
  Lock,
  Users,
} from 'lucide-react';
import api from '../../services/axios';
import { fieldService } from '../../services/field.service';
import type { MajorField } from '../../types/domain';
import { useLocale } from '../../i18n/I18nContext';
import {
  toLocalDatetimeInput,
  toApiIsoString,
  formatDisplayDate,
  formatDisplayTime,
} from '../../utils/datetime';
import {
  deriveEffectiveStatus,
  GOOGLE_MEET_FREE_PARTICIPANT_CAP,
  isValidMeetLink,
  ownsSeminar,
  seminarService,
  type SeminarCard,
} from '../../services/seminar.service';
import {
  useSeminars,
  useCreateSeminar,
  useSendReminder,
  useSeminarRoleContext,
} from '../../hooks/useSeminar';
import { AudioSummaryModal } from '../../components/seminar/AudioSummaryModal';
import { SeminarFeedbackModal } from '../../components/seminar/SeminarFeedbackModal';
import { SeminarFeedbackModalShell } from '../../components/seminar/SeminarFeedbackModalShell';
import { SeminarFeedbackPanel } from '../../components/seminar/SeminarFeedbackPanel';
import { GoogleMeetCapacityMeter } from '../../components/seminar/GoogleMeetCapacityMeter';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import styles from './SeminarWorkspace.module.css';

const SEMINARS_PER_PAGE = 3;

type TabKey = 'all' | 'upcoming' | 'completed' | 'drafts';

const formatSeminarId = (id: number): string =>
  `SEM-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`;

const formatBytesTitle = (raw: string): string => raw;

const toLocalDateTimeInputValue = (date: Date): string => {
  return toLocalDatetimeInput(date);
};

interface InviteeCandidate {
  userId: number;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role?: string;
  subFieldId?: number | null;
  subFieldName?: string | null;
  majorFieldId?: number | null;
}

export const SeminarWorkspace = () => {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const copy = (en: string, vi: string) => (isVi ? vi : en);

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [currentSeminarPage, setCurrentSeminarPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAttendeeFeedbackModal, setShowAttendeeFeedbackModal] =
    useState(false);
  const [
    selectedSeminarForAttendeeFeedback,
    setSelectedSeminarForAttendeeFeedback,
  ] = useState<SeminarCard | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [bannerVariant, setBannerVariant] = useState<'success' | 'error'>(
    'success',
  );
  const [selectedSeminarForFeedback, setSelectedSeminarForFeedback] =
    useState<SeminarCard | null>(null);

  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedSeminarForAi, setSelectedSeminarForAi] =
    useState<SeminarCard | null>(null);

  // Create modal form state
  const [seminarName, setSeminarName] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [seminarDetails, setSeminarDetails] = useState('');
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [emailInputText, setEmailInputText] = useState('');
  const [sendReminder, setSendReminder] = useState(true);

  // Subfield & Suggested Invitees state
  const [majorFields, setMajorFields] = useState<MajorField[]>([]);
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [allInvitees, setAllInvitees] = useState<InviteeCandidate[]>([]);
  const [isLoadingInvitees, setIsLoadingInvitees] = useState(false);
  const [inviteeSearch, setInviteeSearch] = useState('');
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  const [generatedMeetLink, setGeneratedMeetLink] = useState('');

  // ── Seminar data via hooks ───────────────────────────────────────────────────
  const {
    seminars,
    isLoading: isLoadingSeminars,
    error: loadSeminarsError,
    refetch,
    backendAvailability,
  } = useSeminars();

  const { currentRole, currentUserId, canModify } = useSeminarRoleContext();

  const handleCreateSuccess = useCallback(
    (created: { seminarId: number; onlineLink?: string | null }) => {
      setGeneratedMeetLink(created.onlineLink ?? '');
      setBannerText(
        `"${seminarName || 'Seminar'}" has been created.`,
      );
      setBannerVariant('success');
      setShowSuccessBanner(true);
      setShowCreateModal(false);
      setShowGeneratedModal(true);
    },
    [seminarName],
  );

  const { createSeminar, isCreating: isCreatingSeminar } =
    useCreateSeminar(handleCreateSuccess, refetch);

  const { sendReminder: doSendReminder } = useSendReminder(
    undefined,
    refetch,
  );

  // Note: participant list is now fetched inside `SeminarFeedbackPanel`
  // when the owner opens the feedback view. We no longer need to preload it
  // here.
  void doSendReminder;

  // ── Tab filter + counts ───────────────────────────────────────
  const seminarCounts = useMemo(
    () =>
      seminars.reduce(
        (counts, seminar) => {
          const effective = deriveEffectiveStatus(
            seminar.status,
            seminar.endTime,
          );
          if (effective === 'UPCOMING' || effective === 'IN PROGRESS') {
            counts.upcoming += 1;
          } else if (effective === 'COMPLETED') {
            counts.completed += 1;
          } else if (effective === 'DRAFT') {
            counts.drafts += 1;
          }
          return counts;
        },
        { upcoming: 0, completed: 0, drafts: 0 },
      ),
    [seminars],
  );

  const filteredSeminars = useMemo(() => {
    return seminars.filter((sem) => {
      const effective = deriveEffectiveStatus(sem.status, sem.endTime);
      if (activeTab === 'upcoming') {
        return effective === 'UPCOMING' || effective === 'IN PROGRESS';
      }
      if (activeTab === 'completed') return effective === 'COMPLETED';
      if (activeTab === 'drafts') return effective === 'DRAFT';
      return true;
    });
  }, [activeTab, seminars]);

  const totalSeminarPages = Math.max(
    1,
    Math.ceil(filteredSeminars.length / SEMINARS_PER_PAGE),
  );
  const safeSeminarPage = Math.min(currentSeminarPage, totalSeminarPages);
  const paginatedSeminars = useMemo(
    () =>
      filteredSeminars.slice(
        (safeSeminarPage - 1) * SEMINARS_PER_PAGE,
        safeSeminarPage * SEMINARS_PER_PAGE,
      ),
    [filteredSeminars, safeSeminarPage],
  );

  const minDateTime = useMemo(
    () => toLocalDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000)),
    [],
  );

  const announce = useCallback(
    (message: string, variant: 'success' | 'error' = 'success') => {
      setBannerText(message);
      setBannerVariant(variant);
      setShowSuccessBanner(true);
    },
    [],
  );

  // ── Create form helpers ─────────────────────────────────────────
  const handleAddEmail = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && emailInputText.trim()) {
      e.preventDefault();
      const candidate = emailInputText.trim();
      if (!guestEmails.includes(candidate)) {
        setGuestEmails([...guestEmails, candidate]);
      }
      setEmailInputText('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setGuestEmails(guestEmails.filter((x) => x !== email));
  };

  // ── Load Major Fields, Subfields, and Professional Profiles for Invitations ──
  useEffect(() => {
    if (!showCreateModal) return;
    let cancelled = false;

    async function loadData() {
      setIsLoadingInvitees(true);
      try {
        const [majors, profRes, usersRes] = await Promise.allSettled([
          fieldService.getAllMajor(),
          api.get('/api/ProfessionalProfile'),
          api.get('/api/User'),
        ]);

        if (cancelled) return;

        // 1. Process Major & Sub fields
        let loadedMajors: MajorField[] = [];
        if (majors.status === 'fulfilled' && Array.isArray(majors.value)) {
          loadedMajors = majors.value;
          setMajorFields(loadedMajors);
        }

        // 2. Process Users map for role names
        const userRoleMap = new Map<number, string>();
        if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
          const uData = usersRes.value.data;
          const uList = Array.isArray(uData) ? uData : (uData.items || []);
          for (const u of uList) {
            if (u.id) userRoleMap.set(u.id, u.roleName || u.role || '');
          }
        }

        // 3. Process ProfessionalProfiles
        if (profRes.status === 'fulfilled' && Array.isArray(profRes.value?.data)) {
          const profiles = profRes.value.data;
          const candidates: InviteeCandidate[] = profiles
            .filter((p: any) => p && p.userId && p.email)
            .map((p: any) => ({
              userId: p.userId,
              fullName: p.fullName || `User #${p.userId}`,
              email: p.email.trim(),
              avatarUrl: p.avatarUrl,
              role: userRoleMap.get(p.userId) || (p.reviewFee ? 'Reviewer' : 'Scholar'),
              subFieldId: p.subFieldId,
              subFieldName: p.subFieldName,
              majorFieldId: p.majorFieldId,
            }));

          setAllInvitees(candidates);

          // 4. Auto-detect host's subfield if not set
          const myProf = profiles.find((p: any) => p.userId === currentUserId);
          if (myProf?.subFieldId) {
            setSelectedSubId((prev) => prev ?? myProf.subFieldId);
            if (myProf.majorFieldId) {
              setSelectedMajorId((prev) => prev ?? myProf.majorFieldId);
            }
          } else if (loadedMajors.length > 0 && loadedMajors[0].subFields?.length) {
            setSelectedMajorId((prev) => prev ?? loadedMajors[0].id);
            setSelectedSubId((prev) => prev ?? loadedMajors[0].subFields![0].id);
          }
        }
      } catch {
        // Tolerant on background network error
      } finally {
        if (!cancelled) setIsLoadingInvitees(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [showCreateModal, currentUserId]);

  // Whenever selectedSubId changes, also attempt to load suggested invitees from the dedicated BE endpoint:
  useEffect(() => {
    if (!showCreateModal || !selectedSubId) return;
    let cancelled = false;

    async function fetchSuggestedFromBackend() {
      try {
        const beInvitees = await seminarService.getSuggestedInvitees(selectedSubId);
        if (cancelled) return;
        if (Array.isArray(beInvitees) && beInvitees.length > 0) {
          setAllInvitees((prev) => {
            const map = new Map<number, InviteeCandidate>();
            for (const p of prev) map.set(p.userId, p);
            for (const b of beInvitees) {
              if (b.userId && b.email) {
                map.set(b.userId, {
                  userId: b.userId,
                  fullName: b.fullName || `User #${b.userId}`,
                  email: b.email.trim(),
                  avatarUrl: b.avatarUrl,
                  role: b.role || 'Colleague',
                  subFieldId: b.subFieldId ?? selectedSubId,
                  subFieldName: b.subFieldName,
                });
              }
            }
            return Array.from(map.values());
          });
        }
      } catch {
        // Fallback already in place
      }
    }

    void fetchSuggestedFromBackend();

    return () => {
      cancelled = true;
    };
  }, [showCreateModal, selectedSubId]);

  const availableSubFields = useMemo(() => {
    if (!selectedMajorId) {
      return majorFields.flatMap((m) => m.subFields || []);
    }
    const major = majorFields.find((m) => m.id === selectedMajorId);
    return major?.subFields || [];
  }, [majorFields, selectedMajorId]);

  const handleMajorChange = (newMajorId: number | null) => {
    setSelectedMajorId(newMajorId);
    if (!newMajorId) {
      setSelectedSubId(null);
    } else {
      const major = majorFields.find((m) => m.id === newMajorId);
      if (major?.subFields?.length) {
        setSelectedSubId(major.subFields[0].id);
      } else {
        setSelectedSubId(null);
      }
    }
  };

  const filteredInvitees = useMemo(() => {
    if (!selectedSubId) return [];
    return allInvitees.filter((inv) => {
      if (inv.subFieldId !== selectedSubId) return false;
      if (currentUserId && inv.userId === currentUserId) return false;
      if (!inv.email || !inv.email.trim()) return false;
      if (inviteeSearch.trim()) {
        const q = inviteeSearch.toLowerCase();
        const matchName = (inv.fullName || '').toLowerCase().includes(q);
        const matchEmail = (inv.email || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [allInvitees, selectedSubId, currentUserId, inviteeSearch]);

  const allFilteredSelected =
    filteredInvitees.length > 0 &&
    filteredInvitees.every((inv) => guestEmails.includes(inv.email));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      const emailsToRemove = new Set(filteredInvitees.map((inv) => inv.email));
      setGuestEmails(guestEmails.filter((e) => !emailsToRemove.has(e)));
    } else {
      const newEmails = [...guestEmails];
      for (const inv of filteredInvitees) {
        if (!newEmails.includes(inv.email)) {
          newEmails.push(inv.email);
        }
      }
      setGuestEmails(newEmails);
    }
  };

  const handleToggleInvitee = (email: string) => {
    if (guestEmails.includes(email)) {
      setGuestEmails(guestEmails.filter((e) => e !== email));
    } else {
      setGuestEmails([...guestEmails, email]);
    }
  };

  const getRoleClass = (role?: string) => {
    const r = (role || '').toLowerCase();
    if (r.includes('lecturer') || r.includes('giảng viên')) return styles.roleLecturer;
    if (r.includes('researcher') || r.includes('nghiên cứu')) return styles.roleResearcher;
    if (r.includes('reviewer') || r.includes('phản biện')) return styles.roleReviewer;
    return styles.roleDefault;
  };

  const handleCreateSeminarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) {
      announce('You do not have permission to create seminars.', 'error');
      return;
    }
    if (!seminarName.trim()) {
      announce('Please enter a seminar name.', 'error');
      return;
    }
    if (!dateTime.trim()) {
      announce('Please select a date and time.', 'error');
      return;
    }
    if (!seminarDetails.trim()) {
      announce('Please enter seminar details.', 'error');
      return;
    }
    const minTime = new Date(Date.now() + 60 * 60 * 1000);
    if (new Date(dateTime) < minTime) {
      announce(
        'Seminars must be scheduled at least 1 hour in advance.',
        'error',
      );
      return;
    }
    const startTime = toApiIsoString(dateTime) || new Date(dateTime).toISOString();
    const endTime =
      toApiIsoString(new Date(new Date(dateTime).getTime() + 60 * 60 * 1000)) ||
      new Date(new Date(dateTime).getTime() + 60 * 60 * 1000).toISOString();
    const fullContent = seminarName.trim()
      ? `[${seminarName.trim()}] ${seminarDetails.trim()}`
      : seminarDetails.trim();

    try {
      setCreateModalError(null);
      await createSeminar({
        startTime,
        endTime,
        content: fullContent,
        guestEmails: guestEmails.length > 0 ? guestEmails : undefined,
        isReminderSent: sendReminder,
        status: 'Upcoming',
        subFieldId: selectedSubId ?? undefined,
      });
      // Reset form for next create.
      setSeminarName('');
      setDateTime('');
      setSeminarDetails('');
      setGuestEmails([]);
      setEmailInputText('');
      setSendReminder(true);
      setInviteeSearch('');
      setCreateModalError(null);
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { message?: string; title?: string } } })?.response;
      const status = resp?.status;
      let msg =
        resp?.data?.message ||
        resp?.data?.title ||
        (err instanceof Error ? err.message : '') ||
        'Failed to create seminar.';
      if (status === 403) {
        msg = copy(
          'Your account (Researcher) is not authorized by the Backend to create Seminars (403 Forbidden). Backend endpoint POST /api/Seminar currently requires Lecturer ([Authorize(Roles = "Lecturer")]). Please ask Backend to add Researcher ([Authorize(Roles = "Lecturer,Researcher")]) or sign in with a Lecturer account.',
          'Tài khoản của bạn (Researcher) chưa có quyền tạo Seminar trên Backend (Lỗi 403 Forbidden). Endpoint POST /api/Seminar hiện chỉ cấp quyền cho Giảng viên ([Authorize(Roles = "Lecturer")]). Vui lòng nhờ Backend mở thêm quyền cho Researcher ([Authorize(Roles = "Lecturer,Researcher")]) hoặc đăng nhập bằng tài khoản Giảng viên.'
        );
      }
      setCreateModalError(msg);
      announce(msg, 'error');
    }
  };

  const handleOpenFeedbackModal = (sem: SeminarCard) => {
    setSelectedSeminarForFeedback(sem);
    setShowFeedbackModal(true);
  };

  // Legacy reminder entrypoint kept on the page instance so callers can still
  // trigger it via any future "Remind Pending" action. The new
  // SeminarFeedbackPanel owns its own reminder flow for completed seminars.
  void doSendReminder;

  const handleOpenAiSummary = useCallback((sem: SeminarCard) => {
    setSelectedSeminarForAi(sem);
    setShowAiModal(true);
  }, []);

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'all', label: 'All Seminars', count: seminars.length },
    {
      key: 'upcoming',
      label: 'Upcoming',
      count: seminarCounts.upcoming,
    },
    {
      key: 'completed',
      label: 'Completed',
      count: seminarCounts.completed,
    },
    { key: 'drafts', label: 'Drafts', count: seminarCounts.drafts },
  ];

  const headerActions = (
    <>
      <Button
        variant="outline"
        size="md"
        leftIcon={
          isLoadingSeminars ? (
            <Loader size={14} className={styles.spinning} aria-hidden />
          ) : (
            <RefreshCw size={14} aria-hidden />
          )
        }
        onClick={() => void refetch()}
        disabled={isLoadingSeminars}
        aria-label="Refresh seminars"
      >
        {isLoadingSeminars ? 'Refreshing…' : 'Refresh'}
      </Button>
      {canModify && (
        <Button
          variant="primary"
          size="md"
          className={styles.actionBtnLecturer}
          leftIcon={<Plus size={16} aria-hidden />}
          onClick={() => setShowCreateModal(true)}
        >
          Create Seminar
        </Button>
      )}
    </>
  );

  return (
    <div
      className={styles.page}
      data-testid="lecturer-seminar-workspace"
    >
      <PageHeader
        eyebrow={currentRole ? `${currentRole.toUpperCase()} WORKSPACE` : 'WORKSPACE'}
        title="Seminar & Workshop Management"
        description={
          canModify
            ? 'Manage your scheduled seminars, share resources, and collect feedback.'
            : 'Browse upcoming and completed seminars you have been invited to.'
        }
        actions={headerActions}
        accent="var(--ars-lecturer)"
      />

      {/* BANNERS */}
      {showSuccessBanner && (
        <div
          className={`${styles.banner} ${
            bannerVariant === 'error' ? styles.bannerError : ''
          }`}
          role={bannerVariant === 'error' ? 'alert' : 'status'}
        >
          <span className={styles.bannerIcon}>
            {bannerVariant === 'success' ? (
              <Check size={14} strokeWidth={3} aria-hidden />
            ) : (
              <AlertTriangle size={14} aria-hidden />
            )}
          </span>
          <div className={styles.bannerBody}>
            <span className={styles.bannerTitle}>
              {bannerVariant === 'success'
                ? 'Seminar Created Successfully'
                : 'Action Failed'}
            </span>
            <span className={styles.bannerText}>{bannerText}</span>
          </div>
          <button
            type="button"
            className={styles.bannerCloseBtn}
            onClick={() => setShowSuccessBanner(false)}
            aria-label="Dismiss"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {loadSeminarsError && (
        <ErrorBanner
          tone="error"
          title="Failed to load seminars"
          message={loadSeminarsError}
          retry={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          }
        />
      )}

      {backendAvailability !== 'full' && (
        <div className={styles.backendBanner} role="status" aria-live="polite">
          <span className={styles.backendBannerIcon}>
            <Lock size={14} aria-hidden />
          </span>
          <div className={styles.backendBannerBody}>
            <span className={styles.backendBannerTitle}>
              Seminar list unavailable for your role
            </span>
            <p className={styles.backendBannerText}>
              The seminar list is currently only available to the seminar
              organizer (Lecturer role). Showing the BE-wide seminar and
              participant rows to a Researcher, Reviewer, or Graduate Student
              would expose every participant's name and email across the
              platform. Once the BE ships a participant-scoped read, this
              surface will populate automatically — no FE change required.
            </p>
          </div>
        </div>
      )}

      {/* Tabs row */}
      <div className={styles.toolbarRow}>
        <div className={styles.tabs} role="tablist" aria-label="Filter seminars">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              className={`${styles.tabBtn} ${
                activeTab === t.key ? styles.tabActive : ''
              }`}
              onClick={() => {
                setActiveTab(t.key);
                setCurrentSeminarPage(1);
              }}
            >
              {t.label}
              <span className={styles.tabCount}>{t.count}</span>
            </button>
          ))}
        </div>
        <span className={styles.toolbarMeta}>
          Showing {paginatedSeminars.length > 0
            ? `${(safeSeminarPage - 1) * SEMINARS_PER_PAGE + 1}–${Math.min(safeSeminarPage * SEMINARS_PER_PAGE, filteredSeminars.length)}`
            : '0'} of {filteredSeminars.length} seminars
        </span>
      </div>

      {/* List */}
      {isLoadingSeminars ? (
        <SkeletonRow count={4} withHeader />
      ) : backendAvailability !== 'full' ? (
        <EmptyState
          icon={<Lock size={20} aria-hidden />}
          title="Seminars are temporarily unavailable"
          description="The backend did not provide a readable seminar list for this session."
        />
      ) : activeTab === 'drafts' && filteredSeminars.length === 0 ? (
        <EmptyState
          icon={<FileText size={20} aria-hidden />}
          title="No drafts"
          description="Saved drafts will appear here once the BE exposes draft lifecycle."
        />
      ) : filteredSeminars.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} aria-hidden />}
          title="No seminars yet"
          description={
            canModify
              ? 'Click "Create Seminar" to schedule your first one.'
              : 'No seminars scheduled or invited at this time.'
          }
        />
      ) : (
        <ul className={styles.list}>
          {paginatedSeminars.map((sem) => {
            const seminarStartDate = sem.startTime
              ? new Date(sem.startTime)
              : null;
            const seminarEndDate = sem.endTime ? new Date(sem.endTime) : null;
            const dateLabel = seminarStartDate
              ? formatDisplayDate(seminarStartDate, locale)
              : '';
            const timeLabel =
              seminarStartDate && seminarEndDate &&
              !Number.isNaN(seminarStartDate.getTime())
                ? `${formatDisplayTime(seminarStartDate, locale)} – ${formatDisplayTime(seminarEndDate, locale)}`
                : '';
            const isCompleted =
              sem.effectiveStatus === 'COMPLETED' ||
              sem.status === 'COMPLETED';
            const owns = ownsSeminar(sem, currentUserId, currentRole);
            const showAi = canModify && owns && isCompleted;
            const showFeedbackOrganizer =
              canModify && owns && isCompleted;
            return (
                  <li className={styles.seminarCard} key={sem.seminarId}>
                    <div className={styles.cardTopRow}>
                      <div className={styles.metaRow}>
                        <span className={styles.metaBadge}>
                          ID {formatSeminarId(sem.seminarId)}
                        </span>
                      </div>
                      <div className={styles.dateMeta}>
                        <span className={styles.dateMetaInline}>
                          <Calendar size={12} aria-hidden />
                          {dateLabel}
                        </span>
                        <span className={styles.dateMetaInline}>
                          <Clock size={12} aria-hidden />
                          {timeLabel}
                        </span>
                      </div>
                    </div>

                    <h3 className={styles.cardTitle}>
                      {formatBytesTitle(sem.title)}
                    </h3>
                    <p className={styles.cardDescription}>
                      {sem.content || 'No description provided.'}
                    </p>

                    {isValidMeetLink(sem.onlineLink) && !isCompleted && (
                      <div className={styles.capacityWrapper}>
                        <GoogleMeetCapacityMeter
                          current={sem.participantCount || 0}
                          cap={
                            sem.maxParticipants &&
                            sem.maxParticipants > 0
                              ? Math.min(
                                  sem.maxParticipants,
                                  GOOGLE_MEET_FREE_PARTICIPANT_CAP,
                                )
                              : GOOGLE_MEET_FREE_PARTICIPANT_CAP
                          }
                          compact
                        />
                      </div>
                    )}

                    {isValidMeetLink(sem.onlineLink) && (
                      <div className={styles.meetBox}>
                        <Video size={14} aria-hidden />
                        <a
                          href={sem.onlineLink}
                          className={styles.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {sem.onlineLink}
                        </a>
                      </div>
                    )}

                    {isCompleted && (
                      <div className={styles.progressBlock}>
                        <div className={styles.progressLabels}>
                          <span>Feedback submissions</span>
                          <span className={styles.progressValue}>
                            {sem.feedbackSubmitted}/{sem.feedbackTotal}
                          </span>
                        </div>
                        <div className={styles.progressBarBg}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width:
                                sem.feedbackTotal > 0
                                  ? `${(sem.feedbackSubmitted /
                                      sem.feedbackTotal) *
                                      100}%`
                                  : '0%',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className={styles.cardActions}>
                      {isCompleted ? (
                        <>
                          {showAi && (
                            <button
                              type="button"
                              className={styles.actionBtnOutline}
                              onClick={() => handleOpenAiSummary(sem)}
                            >
                              <Eye size={14} aria-hidden />
                              View Notes
                            </button>
                          )}
                          {showFeedbackOrganizer ? (
                            <button
                              type="button"
                              className={styles.actionBtnPrimary}
                              onClick={() => handleOpenFeedbackModal(sem)}
                            >
                              <ClipboardList size={14} aria-hidden />
                              Feedback &amp; Grading
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={styles.actionBtnPrimary}
                              onClick={() => {
                                setSelectedSeminarForAttendeeFeedback(sem);
                                setShowAttendeeFeedbackModal(true);
                              }}
                            >
                              <ClipboardList size={14} aria-hidden />
                              Submit Feedback
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.actionBtnPrimary}
                            onClick={() =>
                              window.open(sem.onlineLink, '_blank')
                            }
                            disabled={!isValidMeetLink(sem.onlineLink)}
                          >
                            <Video size={14} aria-hidden />
                            Join Google Meet
                          </button>
                          {canModify && owns && (
                            <button
                              type="button"
                              className={styles.actionBtnOutline}
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  sem.onlineLink ?? '',
                                );
                                announce('Invite link copied.');
                              }}
                              disabled={!isValidMeetLink(sem.onlineLink)}
                            >
                              <Mail size={14} aria-hidden />
                              Send Invite Link
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.actionBtnGhost}
                            disabled
                          >
                            Feedback (available after completion)
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
          })}
        </ul>
      )}

      {totalSeminarPages > 1 && (
        <div className={styles.paginationRow}>
          <button
            type="button"
            className={styles.paginationBtn}
            onClick={() => setCurrentSeminarPage((p) => Math.max(1, p - 1))}
            disabled={safeSeminarPage <= 1}
          >
            Previous
          </button>
          <span className={styles.paginationLabel}>
            Page {safeSeminarPage} of {totalSeminarPages}
          </span>
          <button
            type="button"
            className={styles.paginationBtn}
            onClick={() =>
              setCurrentSeminarPage((p) => Math.min(totalSeminarPages, p + 1))
            }
            disabled={safeSeminarPage >= totalSeminarPages}
          >
            Next
          </button>
        </div>
      )}

      {/* CREATE SEMINAR MODAL */}
      {showCreateModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={`${styles.modalCard} ${styles.modalCardLarge}`}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <Plus size={18} aria-hidden />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>
                    {copy('Create New Academic Seminar', 'Tạo Buổi Hội Thảo Mới')}
                  </h3>
                  <span className={styles.modalSubtitle}>
                    {copy('A Google Meet link will be auto-generated.', 'Đường dẫn Google Meet sẽ được tạo tự động.')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateModalError(null);
                }}
                aria-label="Close"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <form
              onSubmit={handleCreateSeminarSubmit}
              className={styles.modalBody}
            >
              {createModalError && (
                <div className={styles.modalErrorBanner}>
                  <AlertTriangle size={16} aria-hidden />
                  <span>{createModalError}</span>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="seminar-name">
                  {copy('Seminar Name', 'Tên buổi hội thảo')}
                </label>
                <input
                  id="seminar-name"
                  type="text"
                  className={styles.formInput}
                  value={seminarName}
                  onChange={(e) => setSeminarName(e.target.value)}
                  placeholder="Advanced Cloud Routing Architecture Seminar"
                  required
                />
              </div>

              {/* Seminar Domain & Subfield */}
              <div className={styles.subfieldRow}>
                <div className={styles.subfieldSelectGroup}>
                  <label htmlFor="seminar-major-field">
                    {copy('Major Field', 'Lĩnh vực')}
                  </label>
                  <select
                    id="seminar-major-field"
                    className={styles.subfieldSelect}
                    value={selectedMajorId ?? ''}
                    onChange={(e) =>
                      handleMajorChange(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">
                      {copy('-- Select Major Field --', '-- Chọn lĩnh vực --')}
                    </option>
                    {majorFields.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.subfieldSelectGroup}>
                  <label htmlFor="seminar-sub-field">
                    {copy('Subfield', 'Chuyên ngành')}
                  </label>
                  <select
                    id="seminar-sub-field"
                    className={styles.subfieldSelect}
                    value={selectedSubId ?? ''}
                    onChange={(e) =>
                      setSelectedSubId(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">
                      {copy('-- Select Subfield --', '-- Chọn chuyên ngành --')}
                    </option>
                    {availableSubFields.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="seminar-date">
                  {copy('Date & Time', 'Ngày & Giờ')}
                </label>
                <input
                  id="seminar-date"
                  type="datetime-local"
                  className={styles.formInput}
                  value={dateTime}
                  min={minDateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="seminar-details">
                  {copy('Seminar Details', 'Nội dung chi tiết')}
                </label>
                <textarea
                  id="seminar-details"
                  className={styles.formTextarea}
                  value={seminarDetails}
                  onChange={(e) => setSeminarDetails(e.target.value)}
                  placeholder="Deep dive into modular backend routing networks and high-concurrency telemetry."
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  {copy('Guest Email Invitations', 'Mời người tham dự qua Email')}
                </label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={emailInputText}
                  onChange={(e) => setEmailInputText(e.target.value)}
                  onKeyDown={handleAddEmail}
                  placeholder={copy('Type email and press Enter…', 'Nhập email và nhấn Enter…')}
                />
                <span className={styles.helperText}>
                  {copy('Press Enter to add each address.', 'Nhấn Enter để thêm từng địa chỉ email.')}
                </span>
                {guestEmails.length > 0 && (
                  <div className={styles.emailPills}>
                    {guestEmails.map((email) => (
                      <span key={email} className={styles.emailPill}>
                        <Mail size={12} aria-hidden />
                        {email}
                        <button
                          type="button"
                          className={styles.emailPillRemove}
                          onClick={() => handleRemoveEmail(email)}
                          aria-label={`Remove ${email}`}
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested Invitees in Subfield with Checkboxes */}
                {selectedSubId ? (
                  <div className={styles.suggestedInviteesCard}>
                    <div className={styles.suggestedHeader}>
                      <div className={styles.suggestedTitle}>
                        <Users size={14} aria-hidden />
                        <span>
                          {copy(
                            'Colleagues in Subfield',
                            'Gợi ý người tham gia cùng chuyên ngành',
                          )}
                        </span>
                        <span className={styles.suggestedCountBadge}>
                          {filteredInvitees.length}
                        </span>
                      </div>
                      {filteredInvitees.length > 0 && (
                        <div className={styles.suggestedActions}>
                          <button
                            type="button"
                            className={styles.suggestedToggleAllBtn}
                            onClick={handleToggleSelectAll}
                          >
                            {allFilteredSelected
                              ? copy('Deselect All', 'Bỏ chọn tất cả')
                              : copy('Select All', 'Chọn tất cả')}
                          </button>
                        </div>
                      )}
                    </div>

                    {filteredInvitees.length > 3 && (
                      <input
                        type="text"
                        className={styles.suggestedSearchInput}
                        placeholder={copy(
                          'Search colleague by name or email…',
                          'Tìm kiếm theo tên hoặc email…',
                        )}
                        value={inviteeSearch}
                        onChange={(e) => setInviteeSearch(e.target.value)}
                      />
                    )}

                    <div className={styles.suggestedList}>
                      {isLoadingInvitees ? (
                        <div className={styles.suggestedEmptyState}>
                          <Loader size={14} className={styles.spinning} />{' '}
                          {copy('Loading colleagues…', 'Đang tải danh sách…')}
                        </div>
                      ) : filteredInvitees.length === 0 ? (
                        <div className={styles.suggestedEmptyState}>
                          {copy(
                            'No other colleagues found in this subfield.',
                            'Chưa tìm thấy người dùng nào khác trong chuyên ngành này.',
                          )}
                        </div>
                      ) : (
                        filteredInvitees.map((inv) => {
                          const isChecked = guestEmails.includes(inv.email);
                          return (
                            <div
                              key={inv.userId}
                              className={`${styles.suggestedItem} ${
                                isChecked ? styles.suggestedItemActive : ''
                              }`}
                              onClick={() => handleToggleInvitee(inv.email)}
                            >
                              <input
                                type="checkbox"
                                className={styles.suggestedCheckbox}
                                checked={isChecked}
                                onChange={() => {}}
                                aria-label={`Select ${inv.fullName}`}
                              />
                              <div className={styles.suggestedAvatar}>
                                {inv.avatarUrl ? (
                                  <img
                                    src={inv.avatarUrl}
                                    alt={inv.fullName}
                                  />
                                ) : (
                                  inv.fullName.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className={styles.suggestedUserInfo}>
                                <div className={styles.suggestedNameRow}>
                                  <span className={styles.suggestedName}>
                                    {inv.fullName}
                                  </span>
                                  {inv.role && (
                                    <span
                                      className={`${styles.inviteeRoleBadge} ${getRoleClass(
                                        inv.role,
                                      )}`}
                                    >
                                      {inv.role}
                                    </span>
                                  )}
                                </div>
                                <span className={styles.suggestedEmail}>
                                  {inv.email}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={sendReminder}
                  onChange={(e) => setSendReminder(e.target.checked)}
                />
                <span className={styles.checkboxLabel}>
                  <strong>Send Email Reminder</strong>
                  <span className={styles.checkboxSub}>
                    Auto-send an email reminder to guests one day before the
                    seminar starts.
                  </span>
                </span>
              </label>

              <div className={styles.modalFooter}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreatingSeminar}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  className={styles.actionBtnLecturer}
                  leftIcon={
                    isCreatingSeminar ? (
                      <Loader
                        size={14}
                        className={styles.spinning}
                        aria-hidden
                      />
                    ) : (
                      <Video size={14} aria-hidden />
                    )
                  }
                  disabled={isCreatingSeminar}
                >
                  {isCreatingSeminar
                    ? 'Creating…'
                    : 'Generate & Create Seminar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATED-MEET DIALOG */}
      {showGeneratedModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <span className={styles.generatedIcon}>
              <Check size={28} strokeWidth={3} aria-hidden />
            </span>
            <h3 className={styles.generatedTitle}>
              Seminar Created &amp; Google Meet Link Generated
            </h3>
            <p className={styles.generatedSub}>{seminarName}</p>

            <div className={styles.meetCard}>
              <span className={styles.meetCardLabel}>
                <Video size={14} aria-hidden />
                Google Meet Link
              </span>
              <div className={styles.meetCardRow}>
                <input
                  type="text"
                  className={styles.meetCardInput}
                  value={generatedMeetLink}
                  readOnly
                />
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => {
                    navigator.clipboard.writeText(generatedMeetLink);
                    announce('Google Meet link copied.');
                  }}
                >
                  <FileText size={14} aria-hidden />
                  Copy Link
                </button>
              </div>
            </div>

            <div className={styles.inviteAlert}>
              <div className={styles.inviteAlertTitleRow}>
                <AlertTriangle size={14} aria-hidden />
                <span>
                  Email invitations have been sent to invited guests. An
                  automated reminder will be sent{' '}
                  <strong>1 day before</strong> the seminar starts.
                </span>
              </div>
              <div className={styles.inviteAlertSent}>
                <Mail size={12} aria-hidden />
                Sent to: {guestEmails.join(', ') || '(none)'}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setShowGeneratedModal(false);
                  setSeminarName('');
                  setSeminarDetails('');
                  setDateTime('');
                  setGuestEmails([]);
                  setEmailInputText('');
                  setGeneratedMeetLink('');
                }}
              >
                Back to Seminars
              </Button>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Video size={14} aria-hidden />}
                onClick={() =>
                  window.open(generatedMeetLink, '_blank', 'noopener')
                }
                className={styles.actionBtnSuccess}
              >
                Launch Google Meet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* OWNER FEEDBACK MODAL — pop-up, focus-trapped, scroll-locked */}
      {showFeedbackModal && selectedSeminarForFeedback && (
        <SeminarFeedbackModalShell
          seminarTitle={selectedSeminarForFeedback.title}
          startTime={selectedSeminarForFeedback.startTime}
          endTime={selectedSeminarForFeedback.endTime}
          onClose={() => {
            setShowFeedbackModal(false);
            setSelectedSeminarForFeedback(null);
          }}
        >
          <SeminarFeedbackPanel
            seminarId={selectedSeminarForFeedback.seminarId}
            seminarTitle={selectedSeminarForFeedback.title}
            initialAiSummaryJson={
              typeof selectedSeminarForFeedback.aiSummary === 'string'
                ? selectedSeminarForFeedback.aiSummary
                : null
            }
            initialAiGeneratedAt={
              (selectedSeminarForFeedback as { aiFeedbackGeneratedAt?: string | null })
                .aiFeedbackGeneratedAt ?? null
            }
            onRefreshSeminar={() => {
              void refetch();
            }}
          />
        </SeminarFeedbackModalShell>
      )}

      {/* AI SUMMARY MODAL */}
      {showAiModal && selectedSeminarForAi && (
        <AudioSummaryModal
          seminarId={selectedSeminarForAi.seminarId}
          seminarTitle={selectedSeminarForAi.title}
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          onSuccess={(id) => {
            void refetch();
            void id;
          }}
        />
      )}

      {/* ATTENDEE FEEDBACK MODAL — participant submits structured feedback */}
      {showAttendeeFeedbackModal && selectedSeminarForAttendeeFeedback && (
        <SeminarFeedbackModal
          isOpen={showAttendeeFeedbackModal}
          onClose={() => setShowAttendeeFeedbackModal(false)}
          seminarId={selectedSeminarForAttendeeFeedback.seminarId}
          seminarTitle={selectedSeminarForAttendeeFeedback.title}
          onSuccess={() => {
            void refetch();
          }}
        />
      )}
    </div>
  );
};

export default SeminarWorkspace;

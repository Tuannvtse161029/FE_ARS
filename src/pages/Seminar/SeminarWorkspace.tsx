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
  Users,
  Sliders,
  Star,
  Ban,
  RotateCcw,
  Info,
} from 'lucide-react';
import api from '../../services/axios';
import { fieldService } from '../../services/field.service';
import type { MajorField } from '../../types/domain';
import { useLocale } from '../../i18n/I18nContext';
import {
  parseApiDateTimeAsUtc,
  toLocalDatetimeInput,
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
  useUpdateSeminarStatus,
  type SeminarLifecycleAction,
} from '../../hooks/useSeminar';
import { AudioSummaryModal } from '../../components/seminar/AudioSummaryModal';
import { SeminarFeedbackModal } from '../../components/seminar/SeminarFeedbackModal';
import { SeminarFeedbackModalShell } from '../../components/seminar/SeminarFeedbackModalShell';
import { SeminarFeedbackPanel } from '../../components/seminar/SeminarFeedbackPanel';
import { GoogleMeetCapacityMeter } from '../../components/seminar/GoogleMeetCapacityMeter';
import { QuestionEditorCard } from '../../components/seminar/QuestionEditorCard';
import { SeminarFeedbackSetupModal } from '../../components/seminar/SeminarFeedbackSetupModal';
import type { FeedbackQuestion } from '../../types/seminarFeedback';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmModal } from '../../components/lecturer/ConfirmModal';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import { InviteMoreParticipantsModal } from '../../components/seminar/InviteMoreParticipantsModal';
import { SeminarDetailModal } from '../../components/seminar/SeminarDetailModal';
import { ParticipationTable } from '../../components/seminar/ParticipationTable';
import styles from './SeminarWorkspace.module.css';

const SEMINARS_PER_PAGE = 3;

type TabKey = 'all' | 'upcoming' | 'completed' | 'drafts' | 'inactive';
type WorkspaceTab = 'manage' | 'participate';

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
  roles?: string[];
  subFieldId?: number | null;
  subFieldName?: string | null;
  majorFieldId?: number | null;
}

/**
 * Resolve the current user's role into a human-readable label for the
 * 403 error message. Falls back to "this account" so the message still
 * reads naturally when the role is unknown or absent.
 */
const roleLabelForError = (
  role: string | null | undefined,
  isVi: boolean,
): string => {
  const key = (role ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (key === 'lecturer') return isVi ? 'Giảng viên' : 'Lecturer';
  if (key === 'researcher') return isVi ? 'Nhà nghiên cứu' : 'Researcher';
  if (key === 'reviewer') return isVi ? 'Người phản biện' : 'Reviewer';
  if (key === 'graduatestudent')
    return isVi ? 'Học viên sau đại học' : 'Graduate Student';
  return isVi ? 'tài khoản của bạn' : 'this account';
};

export const SeminarWorkspace = () => {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const copy = (en: string, vi: string) => (isVi ? vi : en);

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('manage');
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
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerText, setBannerText] = useState('');
  const [bannerVariant, setBannerVariant] = useState<'success' | 'error'>(
    'success',
  );
  const [selectedSeminarForFeedback, setSelectedSeminarForFeedback] =
    useState<SeminarCard | null>(null);

  const [showInviteMoreModal, setShowInviteMoreModal] = useState(false);
  const [inviteMoreSeminar, setInviteMoreSeminar] = useState<SeminarCard | null>(null);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailSeminar, setDetailSeminar] = useState<SeminarCard | null>(null);

  // Lifecycle (Suspend / Reactivate) modal — opened by the owner from the
  // seminar card. The modal is destructive when suspending and non-destructive
  // when reactivating. The action id (suspend vs. reactivate) drives the
  // copy + the ConfirmModal variant.
  const [lifecycleTarget, setLifecycleTarget] = useState<SeminarCard | null>(null);
  const [lifecycleAction, setLifecycleAction] =
    useState<SeminarLifecycleAction | null>(null);
  const [lifecycleModalOpen, setLifecycleModalOpen] = useState(false);

  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedSeminarForAi, setSelectedSeminarForAi] =
    useState<SeminarCard | null>(null);

  // "View Notes" info-only modal — opened when an organizer taps the
  // button on a still-upcoming seminar (or one that is currently IN
  // PROGRESS). The full upload + AI summarization only becomes useful
  // once the meeting is over, so on a not-yet-completed seminar we
  // explain the workflow instead of letting the user stare at an empty
  // dropzone. Keeping the trigger wired everywhere (instead of only on
  // COMPLETED) makes the feature discoverable so users know they should
  // be recording the meeting in preparation for the post-meeting step.
  const [showAiInfoModal, setShowAiInfoModal] = useState(false);
  const [aiInfoSeminar, setAiInfoSeminar] = useState<SeminarCard | null>(null);
  const [isAttendeeFeedbackPreview, setIsAttendeeFeedbackPreview] =
    useState(false);

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
  const [lastCreatedSeminarId, setLastCreatedSeminarId] = useState<number | null>(null);
  const [feedbackSetupSeminar, setFeedbackSetupSeminar] = useState<{
    id: number;
    title: string;
    feedbackRaw?: string | null;
  } | null>(null);
  const [createCustomQuestions, setCreateCustomQuestions] = useState<FeedbackQuestion[]>([]);

  // ── Seminar data via hooks ───────────────────────────────────────────────────
  const {
    seminars,
    isLoading: isLoadingSeminars,
    error: loadSeminarsError,
    refetch,
  } = useSeminars();

  const { currentRole, currentUserId, canModify } = useSeminarRoleContext();

  const announce = useCallback(
    (
      message: string,
      variant: 'success' | 'error' = 'success',
      title?: string,
    ) => {
      setBannerText(message);
      setBannerVariant(variant);
      setBannerTitle(
        title ??
          (variant === 'success'
            ? copy('Success', 'Thành công')
            : copy('Action Failed', 'Thao tác thất bại')),
      );
      setShowSuccessBanner(true);
    },
    [copy],
  );

  const handleCreateSuccess = useCallback(
    async (created: { seminarId: number; onlineLink?: string | null }) => {
      setLastCreatedSeminarId(created.seminarId);
      setGeneratedMeetLink(created.onlineLink ?? '');
      announce(
        isVi
          ? `"${seminarName || 'Hội thảo'}" đã được tạo thành công.`
          : `"${seminarName || 'Seminar'}" has been created.`,
        'success',
        copy('Seminar Created Successfully', 'Tạo hội thảo thành công'),
      );
      setShowCreateModal(false);
      setShowGeneratedModal(true);

      if (createCustomQuestions.length > 0) {
        try {
          await seminarService.saveFeedbackQuestions(
            created.seminarId,
            createCustomQuestions,
          );
        } catch {
          // local fallback preserved
        }
      }
    },
    [announce, copy, isVi, seminarName, createCustomQuestions],
  );

  const { createSeminar, isCreating: isCreatingSeminar } =
    useCreateSeminar(handleCreateSuccess, refetch);

  const { sendReminder: doSendReminder } = useSendReminder(
    undefined,
    refetch,
  );

  // Lifecycle (Suspend / Reactivate) hook. The `announce` callback is
  // shared with the create flow so the success banner copy stays
  // consistent. For lifecycle flips we pass explicit localized titles
  // ("Seminar Suspended" / "Seminar Reactivated").
  const { updateStatus: updateSeminarStatus, isUpdating: isUpdatingStatus } =
    useUpdateSeminarStatus(
      (id, action) => {
        const verb =
          action === 'suspend'
            ? copy('suspended', 'tạm dừng')
            : copy('reactivated', 'kích hoạt lại');
        const seminar = seminars.find((s) => s.seminarId === id);
        const title = seminar?.title ?? copy('Seminar', 'Hội thảo');
        const bannerActionTitle =
          action === 'suspend'
            ? copy('Seminar Suspended', 'Đã tạm dừng hội thảo')
            : copy('Seminar Reactivated', 'Đã kích hoạt lại hội thảo');
        const msg = isVi
          ? `"${title}" đã được ${verb}.`
          : `"${title}" has been ${verb}.`;
        announce(msg, 'success', bannerActionTitle);
      },
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
          const effective =
            seminar.effectiveStatus ||
            deriveEffectiveStatus(seminar.status, seminar.endTime);
          if (effective === 'UPCOMING' || effective === 'IN PROGRESS') {
            counts.upcoming += 1;
          } else if (effective === 'COMPLETED') {
            counts.completed += 1;
          } else if (effective === 'DRAFT') {
            counts.drafts += 1;
          } else if (effective === 'INACTIVE') {
            counts.inactive += 1;
          }
          return counts;
        },
        { upcoming: 0, completed: 0, drafts: 0, inactive: 0 },
      ),
    [seminars],
  );

  const filteredSeminars = useMemo(() => {
    return seminars.filter((sem) => {
      const effective =
        sem.effectiveStatus || deriveEffectiveStatus(sem.status, sem.endTime);
      if (activeTab === 'upcoming') {
        return effective === 'UPCOMING' || effective === 'IN PROGRESS';
      }
      if (activeTab === 'completed') return effective === 'COMPLETED';
      if (activeTab === 'drafts') return effective === 'DRAFT';
      if (activeTab === 'inactive') return effective === 'INACTIVE';
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
    () => toLocalDateTimeInputValue(new Date(Date.now() + 5 * 60 * 1000)),
    [],
  );

  // ── Lifecycle handlers (Suspend / Reactivate) ───────────────────
  // The owner triggers the modal from the seminar card; we capture the
  // target + the action id (so the modal title/copy adapt) and the hook
  // performs the actual PUT once the user confirms. Reactivation is a
  // safe, non-destructive action so it skips the confirm modal and runs
  // immediately. Both paths share the same hook — only the destination
  // status differs.
  const openSuspendConfirm = useCallback((sem: SeminarCard) => {
    setLifecycleTarget(sem);
    setLifecycleAction('suspend');
    setLifecycleModalOpen(true);
  }, []);

  const handleReactivate = useCallback(
    async (sem: SeminarCard) => {
      try {
        await updateSeminarStatus(sem.seminarId, 'reactivate');
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : copy('Failed to reactivate the seminar.', 'Không thể kích hoạt lại hội thảo.');
        announce(msg, 'error', copy('Action Failed', 'Thao tác thất bại'));
      }
    },
    [announce, copy, updateSeminarStatus],
  );

  const closeLifecycleModal = useCallback(() => {
    setLifecycleModalOpen(false);
    setLifecycleTarget(null);
    setLifecycleAction(null);
  }, []);

  const handleConfirmLifecycle = useCallback(async () => {
    if (!lifecycleTarget || !lifecycleAction) {
      closeLifecycleModal();
      return;
    }
    try {
      await updateSeminarStatus(lifecycleTarget.seminarId, lifecycleAction);
      closeLifecycleModal();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : lifecycleAction === 'suspend'
            ? copy('Failed to suspend the seminar.', 'Không thể tạm dừng hội thảo.')
            : copy('Failed to reactivate the seminar.', 'Không thể kích hoạt lại hội thảo.');
      announce(msg, 'error', copy('Action Failed', 'Thao tác thất bại'));
      // Keep the modal open on error so the user can retry without
      // re-clicking the card button.
    }
  }, [announce, closeLifecycleModal, copy, lifecycleAction, lifecycleTarget, updateSeminarStatus]);

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
          api.get('/api/User', { params: { role: 'ALL', pageSize: 1000 } }),
        ]);

        if (cancelled) return;

        // 1. Process Major & Sub fields
        let loadedMajors: MajorField[] = [];
        if (majors.status === 'fulfilled' && Array.isArray(majors.value)) {
          loadedMajors = majors.value;
          setMajorFields(loadedMajors);
        }

        // 2. Process Users map for multi-role support
        const userRolesMap = new Map<number, string[]>();
        if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
          const uData = usersRes.value.data;
          const uList = Array.isArray(uData) ? uData : (uData.items || []);
          for (const u of uList) {
            if (u && u.id) {
              const rList: string[] = Array.isArray(u.roles) && u.roles.length > 0
                ? (u.roles as string[]).map(String)
                : (u.roleName ? [String(u.roleName)] : (u.role ? [String(u.role)] : []));
              userRolesMap.set(u.id, rList);
            }
          }
        }

        // 3. Process ProfessionalProfiles
        if (profRes.status === 'fulfilled' && Array.isArray(profRes.value?.data)) {
          const profiles = profRes.value.data;
          const candidates: InviteeCandidate[] = profiles
            .filter((p: any) => p && p.userId && p.email)
            .map((p: any) => {
              const uRoles = userRolesMap.get(p.userId) || [];
              const fallback = p.reviewFee ? 'Reviewer' : 'Scholar';
              const resolvedRoles = uRoles.length > 0 ? uRoles : [fallback];
              return {
                userId: p.userId,
                fullName: p.fullName || `User #${p.userId}`,
                email: p.email.trim(),
                avatarUrl: p.avatarUrl,
                role: resolvedRoles.join(' • '),
                roles: resolvedRoles,
                subFieldId: p.subFieldId,
                subFieldName: p.subFieldName,
                majorFieldId: p.majorFieldId,
              };
            });

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
                const bRoles: string[] = Array.isArray(b.roles) && b.roles.length > 0
                  ? (b.roles as string[]).map(String)
                  : (b.role ? b.role.split(' • ').map((s: string) => s.trim()).filter(Boolean) : ['Colleague']);
                map.set(b.userId, {
                  userId: b.userId,
                  fullName: b.fullName || `User #${b.userId}`,
                  email: b.email.trim(),
                  avatarUrl: b.avatarUrl,
                  role: bRoles.join(' • '),
                  roles: bRoles,
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
    if (r.includes('graduate') || r.includes('học viên') || r.includes('student')) return styles.roleGraduateStudent;
    return styles.roleDefault;
  };

  const formatRoleLabel = (roleName: string): string => {
    const trimmed = (roleName || '').trim();
    const lower = trimmed.toLowerCase().replace(/\s+/g, '');
    if (lower === 'graduatestudent') {
      return copy('Graduate Student', 'Học viên sau đại học');
    }
    if (lower === 'researcher') {
      return copy('Researcher', 'Nhà nghiên cứu');
    }
    if (lower === 'lecturer') {
      return copy('Lecturer', 'Giảng viên');
    }
    if (lower === 'reviewer') {
      return copy('Reviewer', 'Người phản biện');
    }
    if (lower === 'admin' || lower === 'administrator') {
      return copy('Administrator', 'Quản trị viên');
    }
    if (lower === 'scholar') {
      return copy('Scholar', 'Học giả');
    }
    if (lower === 'colleague') {
      return copy('Colleague', 'Đồng nghiệp');
    }
    return trimmed;
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
    // Seminars must be scheduled at least 5 minutes ahead of "now" to
    // account for invite propagation + Google Meet link generation.
    const minTime = new Date(Date.now() + 5 * 60 * 1000);
    if (new Date(dateTime) < minTime) {
      announce(
        'Seminars must be scheduled at least 5 minutes in advance.',
        'error',
      );
      return;
    }
    // Compute `startTime` and `endTime` using the SAME conversion:
    // both interpret the datetime-local input as the user's LOCAL clock
    // time and convert to the corresponding UTC ISO instant. Previously
    // `startTime` used `toApiIsoString()` (which preserves the local
    // clock digits and appends `Z` — treating the user's local clock
    // as UTC), while `endTime` used `new Date(...).toISOString()` (which
    // properly applies the browser's timezone offset to the parsed
    // local time). For a user in UTC+7 picking "01:59", the two
    // approaches produced values 7 hours apart, so `endTime` ended up
    // EARLIER than `startTime` in UTC and the BE rejected the create
    // with "EndTime must be later than StartTime". Using one conversion
    // path for both fields keeps the 1-hour gap intact.
    //
    // The default `minTime` validation above already confirms the
    // datetime string parses to a real Date, so `new Date(dateTime)`
    // here is safe.
    const startDate = new Date(dateTime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const startTime = startDate.toISOString();
    const endTime = endDate.toISOString();
    const fullContent = seminarName.trim()
      ? `[${seminarName.trim()}] ${seminarDetails.trim()}`
      : seminarDetails.trim();

    if (createCustomQuestions.length > 0) {
      const hasEmptyQuestion = createCustomQuestions.some(
        (q) => !q.questionText.trim(),
      );
      if (hasEmptyQuestion) {
        announce(
          copy(
            'Please fill in all feedback question texts or remove empty questions.',
            'Vui lòng điền nội dung cho tất cả các câu hỏi đánh giá hoặc xóa câu hỏi trống.',
          ),
          'error',
        );
        return;
      }
    }

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
      setCreateCustomQuestions([]);
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
        // Role-aware copy: surface the actual account role so a
        // Lecturer whose subscription has lapsed (or whose JWT claim is
        // stale) does not see a message claiming the account is a
        // Researcher. The BE endpoint requirement is also phrased to
        // match the canonical ticket §4 authorization scope.
        const roleLabel = roleLabelForError(currentRole, isVi);
        msg = copy(
          `Your account (${roleLabel}) is not authorized by the Backend to create Seminars (403 Forbidden). Backend endpoint POST /api/Seminar currently requires Lecturer ([Authorize(Roles = "Lecturer")]). Please ask Backend to add Researcher ([Authorize(Roles = "Lecturer,Researcher")]) or sign in with a Lecturer account.`,
          `Tài khoản ${roleLabel} chưa có quyền tạo Seminar trên Backend (Lỗi 403 Forbidden). Endpoint POST /api/Seminar hiện chỉ cấp quyền cho Giảng viên ([Authorize(Roles = "Lecturer")]). Vui lòng nhờ Backend mở thêm quyền cho Researcher ([Authorize(Roles = "Lecturer,Researcher")]) hoặc đăng nhập bằng tài khoản Giảng viên.`
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

  /**
   * Open the read-only "View Notes" info modal on a not-yet-completed
   * seminar. The real upload + AI summarization is gated to COMPLETED
   * seminars (the BE only has the recorded meeting video to summarize
   * once the meeting actually happened). Showing this modal here keeps
   * the affordance discoverable and nudges the organizer to actually
   * record the meeting — without letting them pointlessly upload
   * pre-meeting footage.
   */
  const handleOpenAiInfoForUpcoming = useCallback((sem: SeminarCard) => {
    setAiInfoSeminar(sem);
    setShowAiInfoModal(true);
  }, []);

  const closeAiInfoModal = useCallback(() => {
    setShowAiInfoModal(false);
    setAiInfoSeminar(null);
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
    {
      key: 'inactive',
      label: copy('Inactive', 'Đã tạm dừng'),
      count: seminarCounts.inactive,
    },
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
      {canModify && activeWorkspaceTab === 'manage' && (
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
      data-testid="seminar-workspace"
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

      <div className={styles.workspaceTabs} role="tablist" aria-label="Switch between manage and participate views">
        <button
          type="button"
          role="tab"
          aria-selected={activeWorkspaceTab === 'manage'}
          className={`${styles.tabBtn} ${activeWorkspaceTab === 'manage' ? styles.tabActive : ''}`}
          onClick={() => setActiveWorkspaceTab('manage')}
        >
          {copy('Manage Seminars', 'Quản lý hội thảo')}
          <span className={styles.tabCount}>{seminars.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeWorkspaceTab === 'participate'}
          className={`${styles.tabBtn} ${activeWorkspaceTab === 'participate' ? styles.tabActive : ''}`}
          onClick={() => setActiveWorkspaceTab('participate')}
        >
          <ClipboardList size={14} aria-hidden style={{ marginRight: 4 }} />
          {copy('My Participations', 'Lượt tham gia của tôi')}
        </button>
      </div>

      {activeWorkspaceTab === 'manage' ? (
        <>
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
              {bannerTitle ||
                (bannerVariant === 'success'
                  ? copy('Success', 'Thành công')
                  : copy('Action Failed', 'Thao tác thất bại'))}
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

      {/* Note: the prior `<Lock />` "Seminar list unavailable for your role"
          banner was removed. `useSeminars().backendAvailability` is always
          `'full'` (see `getSeminarBackendAvailability`), so the banner was
          dead code that claimed non-Lecturer roles could not see their list.
          If a future BE change reintroduces a degraded state, replace this
          comment with the same `<div className={styles.backendBanner}>`
          block. */}

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
      ) : activeTab === 'drafts' && filteredSeminars.length === 0 ? (
        <EmptyState
          icon={<FileText size={20} aria-hidden />}
          title="No drafts"
          description="Saved drafts will appear here once the BE exposes draft lifecycle."
        />
      ) : activeTab === 'inactive' && filteredSeminars.length === 0 ? (
        <EmptyState
          icon={<Ban size={20} aria-hidden />}
          title={copy('No inactive seminars', 'Chưa có hội thảo nào tạm dừng')}
          description={copy(
            'Seminars you suspend (Upcoming or In Progress) appear here. You can reactivate any of them later.',
            'Các hội thảo bạn tạm dừng (Sắp diễn ra hoặc Đang diễn ra) sẽ hiển thị tại đây. Bạn có thể kích hoạt lại sau.'
          )}
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
            // Parse the BE's seminar timestamps as UTC so the wall-clock
            // display matches what the lecturer originally picked. The
            // BE sometimes strips the timezone marker (`Z` / `±HH:MM`)
            // when serializing, which would otherwise push the rendered
            // date and time onto the UTC literal digits instead of the
            // actual UTC → local conversion (e.g. `"17:45 on Sep 9"`
            // instead of `"00:45 on Sep 10"` for a UTC+7 viewer).
            const seminarStartDate = sem.startTime
              ? parseApiDateTimeAsUtc(sem.startTime)
              : null;
            const seminarEndDate = sem.endTime
              ? parseApiDateTimeAsUtc(sem.endTime)
              : null;
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
            const isInactive =
              sem.effectiveStatus === 'INACTIVE' ||
              sem.status === 'INACTIVE';
            const isUpcomingish =
              sem.effectiveStatus === 'UPCOMING' ||
              sem.effectiveStatus === 'IN PROGRESS';
            const owns = ownsSeminar(sem, currentUserId, currentRole);
            // Two flavors of the "View Notes" button:
            //   showAiCompleted → full upload + AI summary flow. Only
            //     available after the meeting is over, because that is
            //     when there is a real recording to summarize.
            //   showAiUpcoming  → read-only info popup that explains the
            //     workflow ("record the meeting first, then upload here
            //     once it's done"). Showing this on UPCOMING / IN PROGRESS
            //     cards makes the feature discoverable so organizers know
            //     they should be recording the meeting in preparation.
            const showAiCompleted = canModify && owns && isCompleted;
            const showAiUpcoming = canModify && owns && isUpcomingish;
            const showAi = showAiCompleted || showAiUpcoming;
            const showFeedbackOrganizer =
              canModify && owns && isCompleted;
            // Owner-only lifecycle gates:
            //   - "Suspend" shows on upcoming / in-progress rows so the
            //     owner can take the seminar offline before it starts.
            //   - "Reactivate" shows on INACTIVE rows so the owner can
            //     flip the seminar back to Upcoming from the same card.
            const showSuspend = canModify && owns && isUpcomingish;
            const showReactivate = canModify && owns && isInactive;
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

                    <div className={styles.cardTitleRow}>
                      <h3 className={styles.cardTitle}>
                        {formatBytesTitle(sem.title)}
                      </h3>
                      <span
                        className={`${styles.statusBadge} ${
                          styles[
                            `statusBadge_${sem.effectiveStatus.replace(
                              /\s+/g,
                              '_',
                            )}`
                          ] ?? ''
                        }`}
                      >
                        {sem.effectiveStatus === 'IN PROGRESS' && (
                          <span
                            className={styles.statusPulse}
                            aria-hidden="true"
                          />
                        )}
                        <span>{sem.effectiveStatus}</span>
                      </span>
                    </div>
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
                              {copy('View Notes', 'Xem ghi chú')}
                            </button>
                          )}
                          {showFeedbackOrganizer ? (
                            <button
                              type="button"
                              className={styles.actionBtnPrimary}
                              onClick={() => handleOpenFeedbackModal(sem)}
                            >
                              <ClipboardList size={14} aria-hidden />
                              {copy('Feedback & Grading', 'Đánh giá & Phản hồi')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={styles.actionBtnPrimary}
                              onClick={() => {
                                setSelectedSeminarForAttendeeFeedback(sem);
                                setIsAttendeeFeedbackPreview(false);
                                setShowAttendeeFeedbackModal(true);
                              }}
                            >
                              <ClipboardList size={14} aria-hidden />
                              {copy('Submit Feedback', 'Gửi đánh giá')}
                            </button>
                          )}
                          {canModify && owns && (
                            <button
                              type="button"
                              className={styles.actionBtnOutline}
                              onClick={() => {
                                setFeedbackSetupSeminar({
                                  id: sem.seminarId,
                                  title: sem.title,
                                  feedbackRaw: sem.feedback ?? null,
                                });
                              }}
                            >
                              <Sliders size={14} aria-hidden />
                              {copy('Setup Feedback', 'Cấu hình Feedback')}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.actionBtnGhost}
                            onClick={() => {
                              setDetailSeminar(sem);
                              setShowDetailModal(true);
                            }}
                            aria-label={`View seminar details for ${formatBytesTitle(
                              sem.title,
                            )}`}
                          >
                            <Eye size={14} aria-hidden />
                            {copy('Seminar Detail', 'Chi tiết hội thảo')}
                          </button>
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
                            {copy('Join Google Meet', 'Tham gia Google Meet')}
                          </button>
                          {/* "View Notes" on UPCOMING / IN PROGRESS cards opens
                              a read-only info modal that explains the
                              meeting-recording workflow. The full upload +
                              AI summary experience is reserved for the
                              COMPLETED branch above; here we just want to
                              teach organizers to record the meeting so they
                              have footage to upload later. */}
                          {showAiUpcoming && (
                            <button
                              type="button"
                              className={styles.actionBtnOutline}
                              onClick={() => handleOpenAiInfoForUpcoming(sem)}
                              data-testid="seminar-view-notes-info-button"
                            >
                              <Eye size={14} aria-hidden />
                              {copy('View Notes', 'Xem ghi chú')}
                            </button>
                          )}
                          {canModify && owns && (
                            <button
                              type="button"
                              className={styles.actionBtnOutline}
                              onClick={() => {
                                setInviteMoreSeminar(sem);
                                setShowInviteMoreModal(true);
                              }}
                            >
                              <Mail size={14} aria-hidden />
                              {copy('Invite more participants', 'Mời thêm người tham dự')}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.actionBtnOutline}
                            onClick={() => {
                              setSelectedSeminarForAttendeeFeedback(sem);
                              setIsAttendeeFeedbackPreview(true);
                              setShowAttendeeFeedbackModal(true);
                            }}
                            aria-label={`Preview feedback form for ${formatBytesTitle(
                              sem.title,
                            )}`}
                          >
                            <ClipboardList size={14} aria-hidden />
                            {copy('Preview feedback form', 'Xem trước form')}
                          </button>
                          {canModify && owns && (
                            <button
                              type="button"
                              className={styles.actionBtnOutline}
                              onClick={() => {
                                setFeedbackSetupSeminar({
                                  id: sem.seminarId,
                                  title: sem.title,
                                  feedbackRaw: sem.feedback ?? null,
                                });
                              }}
                            >
                              <Sliders size={14} aria-hidden />
                              {copy('Setup Feedback', 'Cấu hình Feedback')}
                            </button>
                          )}
                          {showSuspend && (
                            <button
                              type="button"
                              className={styles.actionBtnDangerOutline}
                              onClick={() => openSuspendConfirm(sem)}
                              disabled={isUpdatingStatus}
                              data-testid="seminar-suspend-button"
                              title={copy(
                                'Take this seminar offline. You can reactivate it from the Inactive tab.',
                                'Tạm dừng hội thảo này. Bạn có thể kích hoạt lại từ tab Đã tạm dừng.'
                              )}
                            >
                              <Ban size={14} aria-hidden />
                              {copy('Suspend', 'Tạm dừng')}
                            </button>
                          )}
                          {showReactivate && (
                            <button
                              type="button"
                              className={styles.actionBtnOutline}
                              onClick={() => void handleReactivate(sem)}
                              disabled={isUpdatingStatus}
                              data-testid="seminar-reactivate-button"
                              title={copy(
                                'Put this seminar back in the upcoming queue.',
                                'Đưa hội thảo này trở lại hàng đợi sắp diễn ra.'
                              )}
                            >
                              <RotateCcw size={14} aria-hidden />
                              {copy('Reactivate', 'Kích hoạt lại')}
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.actionBtnGhost}
                            onClick={() => {
                              setDetailSeminar(sem);
                              setShowDetailModal(true);
                            }}
                            aria-label={`View seminar details for ${formatBytesTitle(
                              sem.title,
                            )}`}
                          >
                            <Eye size={14} aria-hidden />
                            {copy('Seminar Detail', 'Chi tiết hội thảo')}
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
        </>
      ) : (
        <ParticipationTable embedded />
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
                                  {(() => {
                                    const rolesList = (inv.roles && inv.roles.length > 0)
                                      ? inv.roles
                                      : (inv.role ? inv.role.split(' • ').map((s) => s.trim()).filter(Boolean) : []);
                                    if (rolesList.length === 0) {
                                      rolesList.push('Colleague');
                                    }
                                    return rolesList.map((r) => (
                                      <span
                                        key={r}
                                        className={`${styles.inviteeRoleBadge} ${getRoleClass(r)}`}
                                      >
                                        {formatRoleLabel(r)}
                                      </span>
                                    ));
                                  })()}
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

              {/* FEEDBACK QUESTIONS SECTION */}
              <div className={styles.feedbackSectionCard}>
                <div className={styles.feedbackSectionHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={18} style={{ color: 'var(--ars-primary, #4338ca)' }} />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>
                        {copy('Custom Feedback Questions', 'Tùy chỉnh câu hỏi đánh giá (Feedback riêng)')}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--ars-ink-muted)' }}>
                        {copy(
                          'Configure rating criteria (1–5 stars) or written answers specifically for this seminar session.',
                          'Thiết lập câu hỏi đánh giá sao (1–5 sao) hoặc câu hỏi tự luận theo đúng nội dung buổi hội thảo này.'
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                      setCreateCustomQuestions((prev) => [
                        ...prev,
                        {
                          id: newId,
                          orderIndex: prev.length,
                          type: 'rating',
                          questionText: '',
                          isRequired: true,
                          maxStar: 5,
                        },
                      ]);
                    }}
                    leftIcon={<Plus size={14} aria-hidden />}
                  >
                    {copy('Add Question', 'Thêm câu hỏi')}
                  </Button>
                </div>

                {createCustomQuestions.length === 0 ? (
                  <div className={styles.emptyQuestionsNotice}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.8125rem', color: 'var(--ars-ink-muted)' }}>
                      {copy(
                        'No custom questions added yet. You can add questions now or set them up after creating the seminar.',
                        'Chưa thêm câu hỏi nào. Bạn có thể thêm ngay bây giờ hoặc thiết lập sau khi tạo hội thảo.'
                      )}
                    </p>
                    <button
                      type="button"
                      className={styles.actionBtnOutline}
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      onClick={() => {
                        setCreateCustomQuestions([
                          {
                            id: `q_${Date.now()}_1`,
                            orderIndex: 0,
                            type: 'rating',
                            questionText: copy(
                              'How relevant and insightful was this seminar?',
                              'Mức độ hữu ích và thực tế của buổi hội thảo này?'
                            ),
                            isRequired: true,
                            maxStar: 5,
                          },
                          {
                            id: `q_${Date.now()}_2`,
                            orderIndex: 1,
                            type: 'text',
                            questionText: copy(
                              'What key takeaways or feedback do you have for the speaker?',
                              'Điều bạn tâm đắc nhất hoặc đóng góp ý kiến cho diễn giả?'
                            ),
                            isRequired: false,
                            placeholder: copy('Enter your response...', 'Nhập câu trả lời...'),
                          },
                        ]);
                      }}
                    >
                      <Star size={12} aria-hidden />
                      {copy('Load Starter Questions', 'Tạo mẫu câu hỏi gợi ý')}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {createCustomQuestions.map((q, idx) => (
                      <QuestionEditorCard
                        key={q.id}
                        question={q}
                        index={idx}
                        totalCount={createCustomQuestions.length}
                        onUpdate={(patch) => {
                          setCreateCustomQuestions((prev) =>
                            prev.map((item) => (item.id === q.id ? { ...item, ...patch } : item))
                          );
                        }}
                        onMoveUp={() => {
                          if (idx === 0) return;
                          const list = [...createCustomQuestions];
                          const temp = list[idx];
                          list[idx] = list[idx - 1];
                          list[idx - 1] = temp;
                          setCreateCustomQuestions(list.map((item, i) => ({ ...item, orderIndex: i })));
                        }}
                        onMoveDown={() => {
                          if (idx === createCustomQuestions.length - 1) return;
                          const list = [...createCustomQuestions];
                          const temp = list[idx];
                          list[idx] = list[idx + 1];
                          list[idx + 1] = temp;
                          setCreateCustomQuestions(list.map((item, i) => ({ ...item, orderIndex: i })));
                        }}
                        onDelete={() => {
                          const filtered = createCustomQuestions.filter((item) => item.id !== q.id);
                          setCreateCustomQuestions(filtered.map((item, i) => ({ ...item, orderIndex: i })));
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateCustomQuestions([]);
                  }}
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
                  setLastCreatedSeminarId(null);
                  setCreateCustomQuestions([]);
                }}
              >
                Back to Seminars
              </Button>
              <Button
                variant="outline"
                size="md"
                leftIcon={<Sliders size={14} aria-hidden />}
                onClick={() => {
                  if (lastCreatedSeminarId) {
                    setFeedbackSetupSeminar({
                      id: lastCreatedSeminarId,
                      title: seminarName || 'Seminar',
                    });
                  }
                  setShowGeneratedModal(false);
                }}
              >
                {copy('Set up feedback', 'Cài đặt Feedback')}
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
          // Pass the summary that GET /api/Seminar already returned so the
          // modal opens in "view existing" mode instead of forcing a re-upload
          // (which the BE rejects with HTTP 409 Conflict).
          initialAiSummary={selectedSeminarForAi.aiSummary ?? null}
          onClose={() => setShowAiModal(false)}
          onSuccess={(id) => {
            void refetch();
            void id;
          }}
        />
      )}

      {/* VIEW NOTES — INFO MODAL (UPCOMING / IN PROGRESS ONLY)
          ------------------------------------------------------------------
          Read-only counterpart of the AI Summary Modal. Opened when the
          organizer taps "View Notes" on a seminar that has NOT YET ended.
          The modal explains the intended workflow:

            1. Record the Google Meet session so there is footage of the
               actual discussion.
            2. Once the meeting wraps up, the seminar flips to COMPLETED
               and the upload + AI summary flow unlocks automatically.
            3. They come back here, drop the recorded file in, and the
               system returns a structured meeting summary.

          We deliberately do NOT show a file picker here. The BE has
          nothing useful to summarize before the meeting has actually
          taken place, so we keep the surface informational rather than
          letting the organizer queue up a useless pre-meeting upload. */}
      {showAiInfoModal && aiInfoSeminar && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-notes-info-title"
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>
                  <Star size={18} aria-hidden />
                </span>
                <div>
                  <h3
                    id="view-notes-info-title"
                    className={styles.modalTitle}
                  >
                    {copy(
                      'View Notes — Record the meeting first',
                      'Xem ghi chú — Hãy ghi hình buổi họp trước',
                    )}
                  </h3>
                  <span className={styles.modalSubtitle}>
                    {copy(
                      'How this feature works once the meeting is over',
                      'Cách tính năng này hoạt động khi buổi họp kết thúc',
                    )}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeAiInfoModal}
                aria-label={copy('Close', 'Đóng')}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.viewNotesInfoBanner}>
                <Star size={16} aria-hidden />
                <span>
                  {copy(
                    'This tool summarises a recorded meeting video into structured notes. It only unlocks once the seminar reaches the COMPLETED status.',
                    'Công cụ này tóm tắt video buổi họp đã ghi thành ghi chú có cấu trúc. Tính năng chỉ mở khi hội thảo chuyển sang trạng thái ĐÃ HOÀN THÀNH.',
                  )}
                </span>
              </div>

              <ol className={styles.viewNotesInfoSteps}>
                <li>
                  <strong>
                    {copy(
                      'Join the seminar & record it.',
                      'Tham gia hội thảo và ghi hình buổi họp.',
                    )}
                  </strong>
                  <span>
                    {copy(
                      'Use your screen recorder (e.g. Google Meet built-in recording, OBS, or your OS screen capture) to capture the full discussion while the meeting is in progress.',
                      'Dùng phần mềm ghi màn hình (ví dụ: tính năng ghi hình có sẵn của Google Meet, OBS, hoặc công cụ ghi màn hình của hệ điều hành) để ghi lại toàn bộ nội dung cuộc thảo luận khi buổi họp đang diễn ra.',
                    )}
                  </span>
                </li>
                <li>
                  <strong>
                    {copy(
                      'Wait for the seminar to finish.',
                      'Chờ hội thảo kết thúc.',
                    )}
                  </strong>
                  <span>
                    {copy(
                      'When the end time passes, this card will automatically move from Upcoming to Completed and the full upload flow becomes available.',
                      'Khi thời gian kết thúc đã qua, thẻ hội thảo sẽ tự động chuyển từ Sắp diễn ra sang Đã hoàn thành và luồng tải lên đầy đủ sẽ xuất hiện.',
                    )}
                  </span>
                </li>
                <li>
                  <strong>
                    {copy(
                      'Come back here and upload the recording.',
                      'Quay lại đây và tải video ghi hình lên.',
                    )}
                  </strong>
                  <span>
                    {copy(
                      'Once the seminar is Completed, click "View Notes" again on this card. You will see a dropzone where you can attach the MP4 file you captured — the system will return a structured meeting summary.',
                      'Khi hội thảo đã hoàn thành, nhấn "Xem ghi chú" lần nữa trên thẻ này. Bạn sẽ thấy vùng thả tệp để đính kèm file MP4 đã ghi — hệ thống sẽ trả về bản tóm tắt buổi họp có cấu trúc.',
                    )}
                  </span>
                </li>
              </ol>

              <div className={styles.viewNotesInfoFootnote}>
                <Info size={14} aria-hidden />
                <span>
                  {copy(
                    'Tip: most meeting tools let you start recording from the toolbar once the call is in progress. Save the file locally so you can upload it here after the seminar ends.',
                    'Mẹo: hầu hết công cụ họp cho phép bạn bắt đầu ghi hình từ thanh công cụ khi cuộc gọi đang diễn ra. Lưu file cục bộ để bạn có thể tải lên tại đây sau khi hội thảo kết thúc.',
                  )}
                </span>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <Button
                type="button"
                variant="primary"
                onClick={closeAiInfoModal}
              >
                {copy('Got it', 'Đã hiểu')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ATTENDEE FEEDBACK MODAL — participant submits structured feedback
          (previewMode=true when the organizer opens it before completion) */}
      {showAttendeeFeedbackModal && selectedSeminarForAttendeeFeedback && (
        <SeminarFeedbackModal
          isOpen={showAttendeeFeedbackModal}
          onClose={() => {
            setShowAttendeeFeedbackModal(false);
            setIsAttendeeFeedbackPreview(false);
          }}
          seminarId={selectedSeminarForAttendeeFeedback.seminarId}
          seminarTitle={selectedSeminarForAttendeeFeedback.title}
          previewMode={isAttendeeFeedbackPreview}
          onSuccess={() => {
            void refetch();
          }}
        />
      )}

      {/* SEMINAR FEEDBACK SETUP MODAL */}
      {feedbackSetupSeminar && (
        <SeminarFeedbackSetupModal
          isOpen={Boolean(feedbackSetupSeminar)}
          onClose={() => setFeedbackSetupSeminar(null)}
          seminarId={feedbackSetupSeminar.id}
          seminarTitle={feedbackSetupSeminar.title}
          existingFeedbackRaw={feedbackSetupSeminar.feedbackRaw}
          onSuccess={() => {
            void refetch();
            announce(
              copy(
                'Feedback questions saved successfully.',
                'Đã lưu câu hỏi đánh giá thành công.',
              ),
            );
          }}
        />
      )}

      {/* INVITE MORE PARTICIPANTS MODAL */}
      {showInviteMoreModal && inviteMoreSeminar && (
        <InviteMoreParticipantsModal
          isOpen={showInviteMoreModal}
          onClose={() => {
            setShowInviteMoreModal(false);
            setInviteMoreSeminar(null);
          }}
          seminar={inviteMoreSeminar}
          currentUserId={currentUserId}
          onSuccess={(added) => {
            void refetch();
            announce(
              copy(
                `Invitation${added === 1 ? '' : 's'} sent to ${added} participant${added === 1 ? '' : 's'}.`,
                `Đã gửi lời mời đến ${added} người tham dự.`,
              ),
            );
          }}
        />
      )}

      {/* SEMINAR DETAIL MODAL — read-only pop-up for the new
          "Seminar Detail" action button on each seminar card. */}
      <SeminarDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailSeminar(null);
        }}
        seminar={detailSeminar}
      />

      {/* LIFECYCLE CONFIRM MODAL — owner-only Suspend confirmation.
          Reactivation bypasses this modal and runs immediately because
          reversing a Suspend is a safe action. The modal title / copy /
          variant adapt based on `lifecycleAction`. */}
      {lifecycleModalOpen && lifecycleTarget && lifecycleAction === 'suspend' && (
        <ConfirmModal
          open={lifecycleModalOpen}
          title={copy(
            'Suspend this seminar?',
            'Tạm dừng hội thảo này?',
          )}
          description={copy(
            `"${lifecycleTarget.title}" will be moved to the Inactive tab. Guests keep their invitations but the meeting is no longer promoted in your active list. You can reactivate it at any time.`,
            `"${lifecycleTarget.title}" sẽ được chuyển sang tab Đã tạm dừng. Khách mời vẫn giữ lời mời nhưng buổi họp sẽ không còn xuất hiện trong danh sách đang hoạt động. Bạn có thể kích hoạt lại bất cứ lúc nào.`
          )}
          variant="destructive"
          confirmLabel={copy('Suspend seminar', 'Tạm dừng hội thảo')}
          cancelLabel={copy('Cancel', 'Huỷ')}
          onConfirm={() => void handleConfirmLifecycle()}
          onClose={closeLifecycleModal}
        />
      )}
    </div>
  );
};

export default SeminarWorkspace;

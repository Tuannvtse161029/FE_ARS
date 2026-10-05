// Profile tab/page — authenticated self-service surface for every role.
//
// Sources of truth:
//   - Profile wire shape and route mapping:  src/services/profile.service.ts
//   - Hook (fetch + save lifecycle):        src/hooks/useProfile.ts
//   - Domain types & per-role meta:         src/types/profile.ts
//   - API base URL:                         import.meta.env.VITE_API_BASE_URL
//     (never hardcoded; see ARS project rules)
//   - Swagger contract:                     GET/PUT/PATCH /api/Profile(/id)
//     payload ProfileUpdateRequest — only the keys documented in
//     swagger.json:5717-5821 are sent.
//
// Authorization model:
//   - The page NEVER reads a profile id from a route param, query string,
//     or any other client-controlled source. The authenticated user's id
//     comes from `useAuth().user.userId` and is the single source of truth
//     for every read and write.
//   - The BE remains the SOLE authority on who can edit which profile; the
//     FE does not re-implement ownership checks. The body always carries
//     `userId = authenticatedUserId` so the BE's JWT-derived check can
//     validate. Cross-account writes fail at the BE (we surface the 4xx).
//
// State machine:
//   unauthenticated → loading → (empty | populated)
//                   ↘ error
//   edit-mode toggles from populated → editing → saving → success/error.
//   Validation runs on every keystroke (client-side), then again on save.
//   A successful save exits edit mode and shows a success banner; the user
//   can re-enter edit mode to make further changes.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Clock, Pen, RefreshCw, SlidersHorizontal, UserPlus } from 'lucide-react';
import { AvatarPickerModal } from '../../components/profile/AvatarPickerModal';
import { AvatarVisual } from '../../components/profile/AvatarVisual';
import { useAuth } from '../../context/AuthContext';
import { useAuthStore } from '../../store';
import { storage } from '../../utils/storage';
import { RequestAdditionalRoleModal } from '../../components/profile/RequestAdditionalRoleModal';
import { roleRequestService, type UserPendingRoleRequest } from '../../services/roleRequest.service';
import { userService } from '../../services/user.service';
import { useProfile } from '../../hooks/useProfile';
import { toLocalDateInput, formatDisplayDate } from '../../utils/datetime';
import {
  PROFILE_VALIDATION,
  resolveRoleProfileMeta,
  type Profile as ProfileDto,
  type ProfileUpdateRequest,
} from '../../types/profile';
import { formatDate } from '../../utils/formatDate';
import { ROUTES } from '../../utils/constants';
import { validateVietnameseName } from '../../utils/validationRules';
import { useFollowCounts } from '../../hooks/useFollowers';
import { followerService } from '../../services/follower.service';
import { FollowListModal } from '../../components/profile/FollowListModal';
import { ProfilePublicationsSection } from '../../components/profile/ProfilePublicationsSection';
import { ProfileForumSection } from '../../components/profile/ProfileForumSection';
import { ProfileSectionTabs, type ProfileTabId } from '../../components/profile/ProfileSectionTabs';
import { useReviewerAvailability, useReviewerProfiles } from '../../hooks/useReviewerProfiles';
import { reviewerService, type ReviewerProfile } from '../../services/reviewer.service';
import { useMajorFields, useSubFields } from '../../hooks/useMajorFields';
import type { MajorField, SubField } from '../../types/domain';
import { parseEntityId } from '../../utils/entityId';
import professionalStyles from '../../components/profile/ProfessionalProfileTab.module.css';
import { ProfileBadgesSection } from '../../components/profile/ProfileBadgesSection';
import { useSearchParams } from 'react-router-dom';
import { FeaturedFlairPicker } from '../../components/profile/FeaturedFlairPicker';
import { TopMedalsModal } from '../../components/profile/TopMedalsModal';
import { useAuthorFlair } from '../../hooks/useAuthorFlair';
import { useProfileExtras } from '../../hooks/useProfileExtras';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { SkeletonRow } from '../../components/SkeletonRow';
import { ErrorBanner } from '../../components/ErrorBanner';
import { EmptyState } from '../../components/EmptyState';
import { InlineNotice } from '../../components/InlineNotice/InlineNotice';
import { OrcidIdentityPanel } from '../../components/orcid/OrcidIdentityPanel';
import { OrcidIdentityMarker } from '../../components/identity/OrcidIdentityMarker';
import { isOrcidEligibleRole } from '../../utils/registrationRoles';
import { UserFlairBadge } from '../../components/medals/UserFlairBadge';
import { GENDER_OPTIONS, GENDER_LABEL_FALLBACK, isGenderCode } from '../../utils/genders';
import { useI18n } from '../../i18n/I18nContext';
import { ReviewerPublicView } from '../../components/profile/publicViews/ReviewerPublicView';
import { ResearcherPublicView } from '../../components/profile/publicViews/ResearcherPublicView';
import { LecturerPublicView } from '../../components/profile/publicViews/LecturerPublicView';
import { GraduateStudentPublicView } from '../../components/profile/publicViews/GraduateStudentPublicView';
import { usePublicProfileData } from '../../hooks/usePublicProfileData';
import { formatEntityIdLabel, shouldExposeIds } from '../../utils/idVisibility';
import styles from './Profile.module.css';
import { TrialCountdownCard } from '../../components/profile/TrialCountdownCard';


const ROLE_LABEL_KEYS: Record<string, string> = {
  Researcher: 'profile.title.researcher',
  Reviewer: 'profile.title.reviewer',
  Lecturer: 'profile.title.lecturer',
  'Graduate Student': 'profile.title.graduateStudent',
  Admin: 'profile.title.admin',
};

const ROLE_EYEBROW_KEYS: Record<string, string> = {
  Researcher: 'profile.eyebrow.researcher',
  Reviewer: 'profile.eyebrow.reviewer',
  Lecturer: 'profile.eyebrow.lecturer',
  'Graduate Student': 'profile.eyebrow.graduateStudent',
  Admin: 'profile.eyebrow.admin',
};

const ROLE_SUBTITLE_KEYS: Record<string, string> = {
  Researcher: 'profile.subtitle.researcher',
  Reviewer: 'profile.subtitle.reviewer',
  Lecturer: 'profile.subtitle.lecturer',
  'Graduate Student': 'profile.subtitle.graduateStudent',
  Admin: 'profile.subtitle.admin',
};

type Mode = 'view' | 'edit';

interface DraftFields {
  fullName: string;
  academicTitle: string;
  phoneNumber: string;
  institution: string;
  bio: string;
  keywords: string[];
  avatarInitials: string;
  dateOfBirth: string;
  gender: string;
  address: string;
}

const EMPTY_DRAFT: DraftFields = {
  fullName: '',
  academicTitle: '',
  phoneNumber: '',
  institution: '',
  bio: '',
  keywords: [],
  avatarInitials: '',
  dateOfBirth: '',
  gender: '',
  address: '',
};

/**
 * Render a 1–2 char avatar fallback derived from the fullName. Used when
 * the BE doesn't surface an explicit `avatarInitials` value.
 */
function deriveInitials(fullName: string): string {
  if (!fullName) return '·';
  const parts = fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter(Boolean);
  if (parts.length === 0) return fullName.slice(0, 2).toUpperCase();
  return parts.slice(0, 2).join('').toUpperCase();
}

function isEmptyDraft(draft: DraftFields): boolean {
  return (
    draft.fullName.trim() === '' &&
    draft.academicTitle.trim() === '' &&
    draft.phoneNumber.trim() === '' &&
    draft.institution.trim() === '' &&
    draft.bio.trim() === '' &&
    draft.keywords.length === 0 &&
    draft.avatarInitials.trim() === '' &&
    draft.dateOfBirth.trim() === '' &&
    draft.gender.trim() === '' &&
    draft.address.trim() === ''
  );
}

/**
 * Client-side validation. Returns a `Record<key, errorMessage>` so the
 * page can render per-field error messages and disable Save while any
 * field is invalid. Conservative limits — the BE is the authority.
 */
function validateDraft(draft: DraftFields, t: (key: string, fallback: string, params?: Record<string, string | number>) => string): Partial<Record<keyof DraftFields, string>> {
  const errors: Partial<Record<keyof DraftFields, string>> = {};
  // Vietnamese-name policy is centralised in utils/validationRules so it
  // matches the rule used by the Register form. The Profile page keeps the
  // length bounds in PROFILE_VALIDATION (different max for the bio/institution).
  const nameErr = validateVietnameseName(draft.fullName);
  if (nameErr) {
    errors.fullName = nameErr;
  } else if (draft.fullName.length > PROFILE_VALIDATION.fullName.maxLength) {
    errors.fullName = t('profile.validation.fullNameTooLong', 'Please keep your full name under {max} characters.', { max: PROFILE_VALIDATION.fullName.maxLength });
  }
  if (
    draft.academicTitle.length > PROFILE_VALIDATION.academicTitle.maxLength
  ) {
    errors.academicTitle = t('profile.validation.academicTitleTooLong', 'Please keep the title under {max} characters.', { max: PROFILE_VALIDATION.academicTitle.maxLength });
  }
  if (draft.phoneNumber.length > PROFILE_VALIDATION.phoneNumber.maxLength) {
    errors.phoneNumber = t('profile.validation.phoneTooLong', 'Please keep the phone number under {max} characters.', { max: PROFILE_VALIDATION.phoneNumber.maxLength });
  } else if (
    draft.phoneNumber.trim() !== '' &&
    !PROFILE_VALIDATION.phoneNumber.pattern.test(draft.phoneNumber.trim())
  ) {
    errors.phoneNumber = t('profile.validation.phoneFormat', 'Use digits, spaces, dashes, parentheses, or a leading +.');
  }
  if (draft.institution.length > PROFILE_VALIDATION.institution.maxLength) {
    errors.institution = t('profile.validation.institutionTooLong', 'Please keep the institution under {max} characters.', { max: PROFILE_VALIDATION.institution.maxLength });
  }
  if (draft.bio.length > PROFILE_VALIDATION.bio.maxLength) {
    errors.bio = t('profile.validation.bioTooLong', 'Please keep the bio under {max} characters.', { max: PROFILE_VALIDATION.bio.maxLength });
  }
  if (draft.address.length > PROFILE_VALIDATION.address.maxLength) {
    errors.address = t('profile.validation.addressTooLong', 'Please keep the address under {max} characters.', { max: PROFILE_VALIDATION.address.maxLength });
  }
  if (draft.keywords.length > PROFILE_VALIDATION.keywords.maxItems) {
    errors.keywords = t('profile.validation.keywordsTooMany', 'Please keep at most {max} keywords.', { max: PROFILE_VALIDATION.keywords.maxItems });
  }
  for (const kw of draft.keywords) {
    if (kw.length > PROFILE_VALIDATION.keywords.maxItemLength) {
      errors.keywords = t('profile.validation.keywordTooLong', 'Each keyword must be under {max} characters.', { max: PROFILE_VALIDATION.keywords.maxItemLength });
      break;
    }
  }
  if (
    draft.avatarInitials.trim() !== '' &&
    (!PROFILE_VALIDATION.avatarInitials.pattern.test(draft.avatarInitials.trim()) ||
      draft.avatarInitials.length > PROFILE_VALIDATION.avatarInitials.maxLength)
  ) {
    errors.avatarInitials = t('profile.validation.avatarInitialsInvalid', 'Up to 4 letters or digits, please.');
  }
  return errors;
}

/**
 * Diff a draft against the last-saved profile so we only send fields that
 * actually changed. Mirrors PATCH semantics — the BE doesn't have to
 * overwrite unchanged fields with the same value.
 */
function buildPayload(
  draft: DraftFields,
  previous: DraftFields,
): Partial<ProfileUpdateRequest> {
  const payload: Record<string, string | string[] | null> = {};
  const stringFields: Array<
    Exclude<keyof DraftFields, 'keywords'>
  > = [
    'fullName',
    'academicTitle',
    'phoneNumber',
    'institution',
    'bio',
    'avatarInitials',
    'dateOfBirth',
    'gender',
    'address',
  ];
  for (const key of stringFields) {
    const before = previous[key];
    const after = draft[key];
    if (before !== after) {
      // Empty strings → null so the BE clears the column instead of writing "".
      const trimmed = after.trim();
      payload[key as string] = trimmed === '' ? null : trimmed;
    }
  }
  // Keywords as a whole — only include when the list itself changed so we
  // don't churn the BE on every keystroke.
  const beforeKeywords = previous.keywords.join('\u0001');
  const afterKeywords = draft.keywords.join('\u0001');
  if (beforeKeywords !== afterKeywords) {
    payload.keywords = draft.keywords.length === 0 ? [] : [...draft.keywords];
  }
  return payload as Partial<ProfileUpdateRequest>;
}

function draftFromProfile(p: {
  fullName?: string | null;
  academicTitle?: string | null;
  phoneNumber?: string | null;
  institution?: string | null;
  bio?: string | null;
  keywords?: string[] | null;
  avatarInitials?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
}): DraftFields {
  return {
    fullName: p.fullName ?? '',
    academicTitle: p.academicTitle ?? '',
    phoneNumber: p.phoneNumber ?? '',
    institution: p.institution ?? '',
    bio: p.bio ?? '',
    keywords: Array.isArray(p.keywords) ? [...p.keywords] : [],
    avatarInitials: p.avatarInitials ?? '',
    dateOfBirth: toLocalDateInput(p.dateOfBirth),
    gender: p.gender ?? '',
    address: p.address ?? '',
  };
}

export const Profile = () => {
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const updateAuthUser = useAuthStore((state) => state.updateUser);

  // ── Admin role gate ─────────────────────────────────────────────
  // The Admin role does not own a profile surface — the sidebar entry
  // is hidden and the header dropdown skips "My Profile & Role
  // Upgrades" (see MainLayout.tsx). This guard handles deep-links
  // and stale tabs that bypass the chrome: any time an authenticated
  // Admin lands on `/profile` (own or another user), bounce them to
  // `/admin` so they cannot accidentally edit their account details
  // or inspect member profiles through this surface.
  if (user?.role === 'Admin') {
    return <Navigate to={ROUTES.ADMIN} replace />;
  }

  const { t, locale } = useI18n();
  const authenticatedUserId = user?.userId ?? null;
  const parsedTargetId = routeUserId ? Number(routeUserId) : null;
  const targetUserId = parsedTargetId && Number.isFinite(parsedTargetId) && parsedTargetId > 0
    ? parsedTargetId
    : (authenticatedUserId ?? null);
  const isOwner = authenticatedUserId != null && targetUserId === authenticatedUserId;

  const {
    profile,
    isUnauthenticated,
    isLoading,
    error,
    refetch,
    isSaving,
    saveError,
    save,
    clearSaveError,
  } = useProfile(targetUserId);

  // ── Public-profile role lookup ─────────────────────────────────────────
  // The `/api/Profile/{id}` and `/api/ProfessionalProfile/{id}` endpoints
  // do NOT surface a `roleName` field — the BE returns the academic-profile
  // columns (fullName, institution, hindex, …) but never the user's
  // business role. For an owner we already have `user.role` from the auth
  // store; for a visitor the only authoritative source is
  // `GET /api/User/{id}` (`UserResponse.roleName`, see swagger.json
  // component UserResponse). Without this fetch the visitor-side
  // `roleName` is always null and the badge silently falls back to
  // "Researcher" for every profile — the bug surfaced on John
  // Reviewer's profile.
  //
  // We only run the fetch when the visitor is viewing SOMEONE ELSE
  // (i.e. `!isOwner`) and the route param resolved to a positive id.
  // Errors are swallowed — the page must render even if `/api/User/{id}`
  // 404s (e.g. a suspended account).
  const [publicUserRole, setPublicUserRole] = useState<string | null>(null);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  useEffect(() => {
    if (isOwner || !targetUserId) {
      setPublicUserRole(null);
      return undefined;
    }
    let cancelled = false;
    userService
      .getById(targetUserId)
      .then((fetched) => {
        if (cancelled) return;
        setPublicUserRole(fetched?.roleName ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setPublicUserRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner, targetUserId]);

  // Role resolution priority:
  //   1. Owner viewing their own profile → `user.role` from auth store.
  //   2. Visitor viewing someone else →
  //        a. `publicUserRole` from /api/User/{id} (authoritative role).
  //        b. `profile.roleName` from the professional-profile endpoint
  //           (currently unused by the BE, kept as a future-proof
  //           fallback in case the BE starts emitting it).
  //        c. `null` — render a neutral label, NEVER default to
  //           'Researcher' (the previous fallback mis-classified
  //           Reviewers / Lecturers / Graduate Students / Admins).
  const roleName = isOwner
    ? (user?.role ?? null)
    : (publicUserRole ?? profile?.roleName ?? null);
  const roleMeta = useMemo(() => resolveRoleProfileMeta(roleName), [roleName]);
  // Label: prefer the ROLE_LABEL_KEYS map; if the BE hands back a role we
  // don't have a localised entry for, fall back to the raw string; only
  // when the role is genuinely unknown do we render the neutral
  // 'Member' chip instead of silently labelling the profile
  // "Researcher" (the original bug).
  const roleLabel = roleName && ROLE_LABEL_KEYS[roleName]
    ? t(ROLE_LABEL_KEYS[roleName], roleName)
    : roleName
      ? roleName
      : t('profile.roleBadgeMember', 'Member');
  const roleEyebrow = roleName && ROLE_EYEBROW_KEYS[roleName]
    ? t(ROLE_EYEBROW_KEYS[roleName], roleName)
    : roleName
      ? roleName
      : t('profile.roleBadgeMember', 'Member');
  const roleSubtitle = roleName && ROLE_SUBTITLE_KEYS[roleName]
    ? t(ROLE_SUBTITLE_KEYS[roleName], roleName)
    : roleName
      ? roleName
      : '';
  const accentStyle = { ['--profile-accent' as string]: roleMeta.accentVar } as CSSProperties;

  const { followersCount, followingCount, refetch: refetchCounts } = useFollowCounts(targetUserId);

  // Reddit-style flair row: pull this user's unlocked medals once. The
  // hook is no-op when userId is null (during the unauthenticated /
  // loading guards above). The same module-level cache used by the
  // forum cards means switching between a forum card for author X and
  // this profile will not refetch X's medals.
  //
  // IMPORTANT: pass `null` (not `0`) when no id is resolved — passing 0
  // would be treated as a real user id and trigger a fetch, polluting the
  // cache under the bogus key '0'.
  const flairUserId = targetUserId ?? authenticatedUserId ?? null;
  const { unlockedMedals } = useAuthorFlair(flairUserId);

  // Live preview of this user's published papers + forum posts. Only
  // fetches when we actually have a resolved userId (skipped during the
  // unauthenticated / loading guards above). Sections are read-only and
  // render identically for owner and visitor.
  const {
    publications,
    forumPosts,
    isLoading: isExtrasLoading,
    error: extrasError,
  } = useProfileExtras(targetUserId);

  // ── Role-specific public profile data (Lecturer seminars/groups/materials,
  //     Graduate Student milestones/group membership, Reviewer/Researcher metrics)
  //
  // Joined year: prefer the target profile's `createdAt` (works for both owner
  // and visitor) and only fall back to the authenticated user's `createdAt`
  // when the profile record hasn't loaded yet. This ensures the displayed
  // year is always the TARGET user's joined year, not the visitor's.
  const joinedYear = useMemo(() => {
    const sourceIso = profile?.createdAt ?? user?.createdAt ?? null;
    if (!sourceIso) return null;
    const d = new Date(sourceIso);
    return Number.isFinite(d.getFullYear()) ? d.getFullYear() : null;
  }, [profile?.createdAt, user?.createdAt]);

  const publicProfileData = usePublicProfileData({
    role: roleName as 'Reviewer' | 'Researcher' | 'Lecturer' | 'Graduate Student' | null,
    userId: targetUserId ?? null,
    joinedYear,
    profile,
    publications,
    forumPosts,
  });

  const [isFollowingTarget, setIsFollowingTarget] = useState<boolean>(false);
  const [isFollowActionLoading, setIsFollowActionLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOwner && targetUserId && authenticatedUserId) {
      followerService.isFollowing(targetUserId).then(setIsFollowingTarget).catch(() => {});
    }
  }, [targetUserId, authenticatedUserId, isOwner]);

  const handleToggleFollowTarget = async () => {
    if (!targetUserId || !authenticatedUserId || isOwner || isFollowActionLoading) return;
    setIsFollowActionLoading(true);
    try {
      const nextState = !isFollowingTarget;
      setIsFollowingTarget(nextState);
      if (isFollowingTarget) {
        await followerService.unfollow(targetUserId);
      } else {
        await followerService.follow({ followedId: targetUserId });
      }
      refetchCounts();
    } catch {
      setIsFollowingTarget(isFollowingTarget);
    } finally {
      setIsFollowActionLoading(false);
    }
  };

  const [isFollowModalOpen, setIsFollowModalOpen] = useState<boolean>(false);
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');

  const userRoles = useMemo(() => {
    if (Array.isArray(user?.roles) && user.roles.length > 0) return user.roles;
    if (user?.role) return [user.role];
    return [];
  }, [user]);

  const isStudentWithResearcher =
    userRoles.some((r) => r === 'Graduate Student' || r === 'GraduateStudent') &&
    userRoles.includes('Researcher');

  const [pendingRoleRequest, setPendingRoleRequest] =
    useState<UserPendingRoleRequest | null>(null);
  const [roleRequestSuccessMessage, setRoleRequestSuccessMessage] = useState<
    string | null
  >(null);
  const [isRoleRequestModalOpen, setIsRoleRequestModalOpen] = useState<boolean>(false);

  const canRequestAdditionalRole =
    isOwner &&
    user?.role !== 'Admin' &&
    user?.effectiveRole !== 'Admin' &&
    (!isStudentWithResearcher || pendingRoleRequest != null);

  useEffect(() => {
    if (user?.userId) {
      setPendingRoleRequest(roleRequestService.getPendingRequest(user.userId));
      roleRequestService.fetchPendingRequest(user.userId).then((res) => {
        setPendingRoleRequest(res);
      });
    }
  }, [user?.userId]);

  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [savedDraft, setSavedDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keywordDraft, setKeywordDraft] = useState<string>('');

  // ── Tab navigation (Phase 3) ─────────────────────────────────
  // The Profile page splits its content into three top-level tabs:
  //   account     — Personal profile details + edit form (owner only)
  //   professional — Research expertise / availability / metrics
  //                 (Reviewer / Researcher / Lecturer, owner only)
  //   public      — Role-specific public view + forum posts +
  //                 publications + badges. Visible to both owner and
  //                 visitor; visitors land here by default.
  //
  // The page also accepts `?tab=account|professional|public` so the
  // legacy /reviewer/professional-profile redirect
  // (`/profile?tab=professional`) lands on the right tab. We resolve
  // the requested tab once on mount and let the tab strip drive the
  // rest via `setActiveTab`. If the requested tab is not visible to the
  // current viewer (e.g. a visitor asked for `tab=professional`), the
  // tab strip falls back to the first visible tab automatically.
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  // After the Profile + Professional Profile merge, every owner sees the
  // same two-tab strip: `account` (editable) and `public` (read-only).
  // Visitors still only see `public`.
  const visibleTabs: ProfileTabId[] = isOwner ? ['account', 'public'] : ['public'];
  const resolveInitialTab = (): ProfileTabId => {
    if (requestedTab === 'account' && visibleTabs.includes('account')) return 'account';
    if (requestedTab === 'public' && visibleTabs.includes('public')) return 'public';
    return visibleTabs[0];
  };
  const [activeTab, setActiveTab] = useState<ProfileTabId>(resolveInitialTab);

  // unlockedMedals comes from the existing flair fetch above. We just
  // count unlocked ones for the badge chip on the Badges tab.
  const unlockedBadgeCount = useMemo(
    () => unlockedMedals.filter((m) => m && m.isUnlocked).length,
    [unlockedMedals],
  );

  // ── Merged Professional Profile surface ──────────────────
  // After folding the Professional tab into the Profile (account) tab,
  // the same data hooks the old ProfessionalProfileTab used now power the
  // expertise + metrics blocks rendered inside `tabpanel-account`. We keep
  // the data flow here (instead of in the inline sub-component) so the
  // 14-day auto-refresh interval can survive tab switches and edit-mode
  // toggles without bouncing refetches.
  const isEligibleProfessionalRole = roleName === 'Researcher'
    || roleName === 'Reviewer'
    || roleName === 'Lecturer';
  const professionalUserId = targetUserId ?? authenticatedUserId ?? undefined;
  const {
    profiles: reviewerProfiles,
    isLoading: isProfLoading,
    error: profError,
    refetch: refetchReviewerProfiles,
  } = useReviewerProfiles();
  const professionalProfile = useMemo(
    () => (professionalUserId
      ? reviewerProfiles.find((p) => p.userId === professionalUserId) ?? null
      : null),
    [reviewerProfiles, professionalUserId],
  );
  const {
    isAvailable: reviewerIsAvailable,
    isLoading: isAvailLoading,
  } = useReviewerAvailability(professionalUserId);

  // 14-day auto-refresh of academic metrics. The interval fires while the
  // tab is mounted; cleanup on unmount avoids leaking the timer when the
  // user signs out or navigates away.
  const METRICS_REFRESH_MS = 14 * 24 * 60 * 60 * 1000;
  const [lastMetricsRefresh, setLastMetricsRefresh] = useState<Date | null>(() => new Date());
  const triggerMetricsRefresh = useCallback(async () => {
    await refetchReviewerProfiles();
    setLastMetricsRefresh(new Date());
  }, [refetchReviewerProfiles]);
  useEffect(() => {
    if (!isEligibleProfessionalRole) return undefined;
    const id = window.setInterval(() => {
      void triggerMetricsRefresh();
    }, METRICS_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [isEligibleProfessionalRole, triggerMetricsRefresh]);

  // Research Expertise local state — lifted from the old
  // ProfessionalProfileTab so it can live alongside the merged account tab.
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [expertiseFeedback, setExpertiseFeedback] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);
  const [isSubmittingExpertise, setIsSubmittingExpertise] = useState(false);
  const [isExpertiseRetrying, setIsExpertiseRetrying] = useState(false);

  // Load Major Fields + Sub Fields for the expertise selectors.
  const { fields: majorFields, isLoading: isMajorsLoading } = useMajorFields();
  const { subFields, isLoading: isSubsLoading } = useSubFields(selectedMajorId);

  // Seed expertise from the current professional profile whenever it
  // resolves. Mirrors the behaviour of the old ProfessionalProfileTab.
  useEffect(() => {
    if (professionalProfile) {
      setSelectedMajorId(professionalProfile.majorFieldId ?? null);
      setSelectedSubId(professionalProfile.subFieldId ?? null);
    }
  }, [professionalProfile?.userId, professionalProfile?.majorFieldId, professionalProfile?.subFieldId]);

  const isExpertiseValid = selectedMajorId !== null && selectedSubId !== null;
  const hasExpertiseChanged =
    selectedMajorId !== (professionalProfile?.majorFieldId ?? null) ||
    selectedSubId !== (professionalProfile?.subFieldId ?? null);

  const handleMajorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMajorId(parseEntityId(event.target.value));
    setSelectedSubId(null);
    setExpertiseFeedback(null);
  };
  const handleSubChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubId(parseEntityId(event.target.value));
    setExpertiseFeedback(null);
  };
  const handleExpertiseRetry = async () => {
    setIsExpertiseRetrying(true);
    try {
      await triggerMetricsRefresh();
    } finally {
      setIsExpertiseRetrying(false);
    }
  };
  const handleSaveExpertise = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !professionalProfile
      || professionalUserId === undefined
      || !isExpertiseValid
      || !hasExpertiseChanged
      || isSubmittingExpertise
    ) {
      if (!isExpertiseValid) {
        setExpertiseFeedback({
          type: 'error',
          message: t('profile.professional.expertise.validation.required'),
        });
      }
      return;
    }
    const previousMajor = professionalProfile.majorFieldId;
    const previousSub = professionalProfile.subFieldId;
    setIsSubmittingExpertise(true);
    setExpertiseFeedback(null);
    try {
      await reviewerService.update(professionalUserId, {
        userId: professionalUserId,
        majorFieldId: selectedMajorId,
        subFieldId: selectedSubId,
      });
      await triggerMetricsRefresh();
      setExpertiseFeedback({ type: 'success', message: t('profile.professional.expertise.saved') });
    } catch (saveError) {
      setSelectedMajorId(previousMajor ?? null);
      setSelectedSubId(previousSub ?? null);
      setExpertiseFeedback({
        type: 'error',
        message: saveError instanceof Error && saveError.message
          ? saveError.message
          : t('profile.professional.expertise.saveFailed'),
      });
    } finally {
      setIsSubmittingExpertise(false);
    }
  };

  // ── Gender — localStorage-backed override ────────────────
  // The BE's `ProfileUpdateRequest` accepts `gender` (free-form string)
  // but its `ProfileResponse` does NOT echo it back. We therefore:
  //   1. Read the user's previous pick from localStorage on mount and
  //      use it as the draft value if the BE didn't return one (the BE
  //      never does, so this is the normal path).
  //   2. Mirror every selection into localStorage so reload preserves it.
  // When the BE formally ships `gender` in the response schema, delete
  // this block and the `ars_gender_<userId>` writes. No central
  // sign-out cleanup exists for `ars_*` keys (see `ars_flair_<userId>` —
  // same model) so a stale entry simply overwrites on the next save.
  const genderStorageKey = (uid: number): string => `ars_gender_${uid}`;

  // Mirror changes into localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const uid = targetUserId ?? authenticatedUserId;
    if (!uid) return;
    try {
      if (draft.gender && isGenderCode(draft.gender)) {
        window.localStorage.setItem(genderStorageKey(uid), draft.gender);
      } else if (!draft.gender) {
        // Empty selection — clear the cached pick so the next mount is honest.
        window.localStorage.removeItem(genderStorageKey(uid));
      }
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [draft.gender, targetUserId, authenticatedUserId]);

  // ── Featured flair (Phase 2.5) ────────────────────────────────
  // Flair persists in localStorage (`ars_flair_<userId>`), NOT in the BE
  // profile row. The live Swagger `ProfileUpdateRequest` schema does not
  // declare `flairMedalId` / `flairOrder` (see src/types/profile.ts), and
  // the BE rejects undocumented keys with a 400 (additionalProperties:
  // false). FeaturedFlairPicker writes to localStorage on every change,
  // and UserFlairBadge rehydrates from the same key on read, so the
  // picker's state stays in sync with the public badge without touching
  // the BE column. When the BE formally ships flair columns, lift the
  // localStorage write into the PUT/PATCH body and re-add the keys to
  // PROFILE_UPDATE_KEYS — keep these two changes atomic.
  const flairStorageKey = (uid: number): string => `ars_flair_${uid}`;

  const [flairMedalId, setFlairMedalId] = useState<string | null>(
    profile?.flairMedalId ?? null,
  );
  const [flairOrder, setFlairOrder] = useState<string[]>(
    Array.isArray(profile?.flairOrder) ? profile.flairOrder : [],
  );
  const [isTopMedalsModalOpen, setIsTopMedalsModalOpen] = useState(false);

  // Seed from localStorage on mount / when targetUserId changes. We
  // deliberately do NOT re-seed when `profile` changes — the user's local
  // pick should win over a stale BE value.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const uid = targetUserId ?? authenticatedUserId;
    if (!uid) return;
    try {
      const raw = window.localStorage.getItem(flairStorageKey(uid));
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        flairMedalId?: string;
        flairOrder?: string[];
      };
      if (typeof parsed.flairMedalId === 'string') {
        setFlairMedalId(parsed.flairMedalId);
      }
      if (Array.isArray(parsed.flairOrder)) {
        setFlairOrder(parsed.flairOrder);
      }
    } catch {
      /* ignore */
    }
  }, [targetUserId, authenticatedUserId]);

  const handleFlairChange = useCallback(
    (next: { flairMedalId: string | null; flairOrder: string[] }) => {
      setFlairMedalId(next.flairMedalId);
      setFlairOrder(next.flairOrder);
    },
    [],
  );

  const selectedTopMedalIds = useMemo(() => {
    const unlockedIds = new Set(
      unlockedMedals.filter((item) => item.isUnlocked && item.medal).map((item) => item.medal.id),
    );
    const ordered = flairOrder.filter((id) => unlockedIds.has(id));
    if (ordered.length > 0) return ordered.slice(0, 3);
    return unlockedMedals
      .filter((item) => item.isUnlocked && item.medal)
      .map((item) => item.medal.id)
      .slice(0, 3);
  }, [flairOrder, unlockedMedals]);

  const handleTopMedalsSave = (selectedIds: string[]) => {
    const remaining = flairOrder.filter((id) => !selectedIds.includes(id));
    handleFlairChange({
      flairMedalId: selectedIds[0] ?? null,
      flairOrder: [...selectedIds, ...remaining],
    });
  };

  const selectedTopMedals = useMemo(
    () => selectedTopMedalIds
      .map((id) => unlockedMedals.find((item) => item.medal?.id === id))
      .filter((item): item is typeof unlockedMedals[number] => Boolean(item)),
    [selectedTopMedalIds, unlockedMedals],
  );

  // Seed the draft whenever the BE profile resolves / changes.
  useEffect(() => {
    if (!profile) {
      setDraft(EMPTY_DRAFT);
      setSavedDraft(EMPTY_DRAFT);
      return;
    }
    const next = draftFromProfile(profile);
    // FE_GENDER_LOCAL_PERSISTENCE — the BE's `ProfileResponse` doesn't echo
    // `gender` back, so the draft seeded from the profile will always be
    // empty for this field. Re-hydrate from localStorage on every profile
    // change so the user's last pick survives reloads, targetUserId swaps,
    // and stale cache invalidations. We deliberately re-seed on `updatedAt`
    // too (not just `userId`) so a fresh PUT that DOES happen to echo the
    // value still wins over localStorage for that one render.
    const uid = targetUserId ?? authenticatedUserId;
    if (uid && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(genderStorageKey(uid));
        if (raw && isGenderCode(raw) && !next.gender) {
          next.gender = raw;
        }
      } catch {
        /* ignore */
      }
    }
    setDraft(next);
    setSavedDraft(next);
    // Don't auto-flip out of edit mode here — the user might still be typing
    // after a successful save, in which case the hook has already pushed the
    // freshest profile back through `profile`. We re-seed only on id change.
  }, [profile?.userId, profile?.updatedAt, targetUserId, authenticatedUserId]);

  // Auto-dismiss the success banner after a few seconds.
  useEffect(() => {
    if (!showSuccess) return;
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = setTimeout(() => setShowSuccess(false), 4000);
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, [showSuccess]);

  const validationErrors = useMemo(() => validateDraft(draft, t), [draft, t]);
  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const payload = useMemo(() => buildPayload(draft, savedDraft), [draft, savedDraft]);
  const hasChanges = Object.keys(payload).length > 0;
  const draftIsEmpty = isEmptyDraft(draft);

  const handleEnterEdit = () => {
    setAvatarError(null);
    setMode('edit');
    setShowSuccess(false);
    clearSaveError();
  };

  const handleCancelEdit = () => {
    setAvatarError(null);
    setDraft(savedDraft);
    setMode('view');
    clearSaveError();
    setKeywordDraft('');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (hasValidationErrors || isSaving || !hasChanges) return;
    // Flair persistence lives in localStorage (`ars_flair_<userId>`), not
    // the PUT/PATCH body. The live Swagger ProfileUpdateRequest schema
    // does not declare `flairMedalId` / `flairOrder`, and shipping those
    // keys would trip the BE's `additionalProperties: false` check.
    // FeaturedFlairPicker writes to localStorage on every change, so the
    // badge and the picker stay in sync without involving the BE column.
    const updated = await save(payload);
    if (updated) {
      const next = draftFromProfile(updated);
      setDraft(next);
      setSavedDraft(next);
      setMode('view');
      setShowSuccess(true);
      setKeywordDraft('');
    }
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleAvatarSave = async (avatarUrl: string) => {
    if (!authenticatedUserId || !user) throw new Error(t('profile.avatar.authRequired', 'You must be signed in to update your avatar.'));
    setAvatarError(null);
    const authoritative = await userService.getById(authenticatedUserId);
    await userService.update(authenticatedUserId, {
      fullName: authoritative.fullName.trim(),
      avatarUrl,
      isActive: authoritative.isActive,
    });
    // Re-read the user so the header dropdown reflects the new avatar. The
    // PUT response (`UserResponse`) omits identity fields like `username`,
    // so trusting it would strip those from the auth store and break the
    // header. `GET /api/User/{id}` returns the full, authoritative row —
    // including the just-saved `avatarUrl` — and matches the `User` shape
    // `storage.setUser` and `useAuthStore` expect.
    const refreshed = await userService.getById(authenticatedUserId);
    storage.setUser(refreshed);
    updateAuthUser(refreshed);
    await refetch();
  };

  const handleAddKeyword = () => {
    const value = keywordDraft.trim();
    if (!value) return;
    setDraft((prev) =>
      prev.keywords.includes(value)
        ? prev
        : { ...prev, keywords: [...prev.keywords, value] },
    );
    setKeywordDraft('');
  };

  const handleKeywordKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      handleAddKeyword();
    } else if (
      event.key === 'Backspace' &&
      keywordDraft === '' &&
      draft.keywords.length > 0
    ) {
      // Convenience: empty backspace removes the last chip.
      setDraft((prev) => ({ ...prev, keywords: prev.keywords.slice(0, -1) }));
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setDraft((prev) => ({ ...prev, keywords: prev.keywords.filter((x) => x !== kw) }));
  };

  const handleFieldChange = <K extends keyof DraftFields>(
    key: K,
    value: DraftFields[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  // ── Render guards (states the page must handle explicitly) ──────────

  if (isUnauthenticated) {
    return (
      <div className={styles.page} style={accentStyle}>
        <PageHeader
          title={t('profile.authRequired.title', 'Sign in to view your profile')}
          description={t('profile.authRequired.description', 'Your academic profile is private and only available once you have signed in. Please return to the sign-in page and authenticate to continue.')}
        />
        <EmptyState
          icon={null}
          title={t('profile.unavailable.title', 'Profile unavailable')}
          description={t('profile.unavailable.description', 'Authenticate to continue.')}
        />
      </div>
    );
  }

  if (isLoading && !profile) {
    return (
      <div className={styles.page} style={accentStyle}>
        <PageHeader
          title={isOwner ? t('profile.view.yourProfile', 'Your profile') : `${roleLabel}`}
          description={t('profile.loadingDescription', 'Fetching the latest profile information from the ARS platform.')}
        />
        <SkeletonRow count={6} rowHeight={48} gap={12} withHeader />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className={styles.page} style={accentStyle}>
        <PageHeader
          title={isOwner ? t('profile.view.yourProfile', 'Your profile') : `${roleLabel}`}
        />
        <ErrorBanner
          tone="error"
          title={t('profile.loadErrorTitle', "Couldn't load profile")}
          message={error.message}
          retry={
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              data-testid="profile-retry-button"
            >
              {t('profile.retry', 'Retry')}
            </Button>
          }
        />
      </div>
    );
  }

  // Empty profile: no row on the BE yet. Still let the user fill the form.
  const hasProfile = profile !== null;
  const isEmptyProfile = !hasProfile || (hasProfile && draftIsEmpty);

  // ── ID-visibility gate ────────────────────────────────────────────
  // Only Admins see internal database IDs in the UI (per the QA
  // recommendation). Other roles see anonymous fallbacks like "User"
  // instead of "User #14".
  const canViewIds = shouldExposeIds({
    effectiveRole: user?.effectiveRole ?? null,
    role: user?.role ?? null,
    roleName: user?.role ?? null,
    roleId: user?.roleId ?? null,
  });

  // ── Main render ────────────────────────────────────────────────────

  const displayName =
    profile?.fullName?.trim() ||
    (isOwner ? (user?.username || user?.email) : '') ||
    formatEntityIdLabel('User', targetUserId, canViewIds);
  const displayEmail = profile?.email || (isOwner ? user?.email : '') || '';
  const avatarInitials = profile?.avatarInitials?.trim() || deriveInitials(displayName);
  const avatarUrl = profile?.avatarUrl ?? user?.avatarUrl ?? null;

  return (
    <div className={styles.page} style={accentStyle}>
      {/* PageHeader is owner-only. Visitors to `/profile/:userId` only
          see the role-specific public view content below
          (ResearcherPublicView, ReviewerPublicView, LecturerPublicView,
          GraduateStudentPublicView) — they do not need the page-title
          banner. The Follow/Following + Refresh actions still need to
          be reachable for visitors, so we render them in a minimal
          actions bar instead of the full PageHeader. */}
      {isOwner ? (
        <PageHeader
          title={roleEyebrow}
          description={roleSubtitle}
          accent={roleMeta.accentVar}
          actions={
            mode === 'view' ? (
              <>
                {canRequestAdditionalRole && (
                  <Button
                    variant={pendingRoleRequest ? 'secondary' : 'outline'}
                    size="md"
                    leftIcon={
                      pendingRoleRequest ? (
                        <Clock size={14} aria-hidden />
                      ) : (
                        <UserPlus size={14} aria-hidden />
                      )
                    }
                    onClick={() => setIsRoleRequestModalOpen(true)}
                    data-testid="profile-request-role-button"
                    title={
                      pendingRoleRequest
                        ? t('profile.requestPending', 'Role request pending')
                        : t('profile.requestRole', 'Request additional role')
                    }
                  >
                    {pendingRoleRequest
                      ? t('profile.requestPending', 'Role request pending')
                      : t('profile.requestRole', 'Request additional role')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<RefreshCw size={14} />}
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  {isLoading ? t('profile.refreshing', 'Refreshing…') : t('profile.refresh', 'Refresh')}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleEnterEdit}
                  data-testid="profile-edit-button"
                >
                  {t('profile.editButton', 'Edit profile')}
                </Button>
              </>
            ) : null
          }
        />
      ) : mode === 'view' ? (
        <div className={styles.visitorActions} data-testid="profile-visitor-actions">
          <div className={styles.visitorActionsTitle}>
            <span className={styles.visitorActionsEyebrow}>
              {t('profile.title.publicEyebrow', 'Public profile')}
            </span>
            <h1 className={styles.visitorActionsName} data-testid="profile-visitor-display-name">
              {displayName}
            </h1>
          </div>
          <div className={styles.visitorActionsButtons}>
            <Button
              variant="outline"
              size="md"
              leftIcon={<RefreshCw size={14} />}
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? t('profile.refreshing', 'Refreshing…') : t('profile.refresh', 'Refresh')}
            </Button>
            {authenticatedUserId ? (
              <Button
                variant={isFollowingTarget ? 'outline' : 'primary'}
                size="md"
                onClick={handleToggleFollowTarget}
                disabled={isFollowActionLoading}
              >
                {isFollowActionLoading
                  ? '…'
                  : isFollowingTarget
                    ? t('profile.followingBadge', 'Following')
                    : t('profile.follow', '+ Follow')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Identity card is owner-only. Visitors see the role-specific
          public view's identity strip (rendered inside the public view
          component), which already includes the role badge and
          account-creation year, so showing the masthead identity card
          here would just duplicate the same information. */}
      {isOwner ? (
      <section className={styles.identityCard} aria-label="Account identity">
        {isOwner && mode === 'edit' ? (
          <button type="button" className={styles.avatar} onClick={() => setIsAvatarPickerOpen(true)} aria-label={t('profile.avatar.open', 'Change profile picture')}>
            <AvatarVisual url={avatarUrl} initials={avatarInitials} size={56} />
            <span className={styles.avatarEditHint} aria-hidden="true"><Pen size={16} strokeWidth={2.25} /></span>
          </button>
        ) : (
          <div className={styles.avatar} aria-label={`Avatar for ${displayName}`}>
            <AvatarVisual url={avatarUrl} initials={avatarInitials} size={56} />
          </div>
        )}
        {avatarError ? <p className={styles.fieldError} role="alert">{avatarError}</p> : null}
        <div className={styles.identityText}>
          <h2 className={styles.identityName} data-testid="profile-display-name">
            {displayName}
            <OrcidIdentityMarker
              orcidId={profile?.orcidId}
              isOrcidVerified={profile?.isOrcidVerified}
            />
          </h2>
          <p className={styles.identityRole}>
            <span className={styles.roleBadge}>{roleLabel}</span>
            {selectedTopMedals.length > 0 ? (
              <span
                className={styles.flairRow}
                aria-label={t('badges.topMedals.aria', 'Top profile medals')}
              >
                {selectedTopMedals.map((item) =>
                  flairUserId != null ? (
                    <UserFlairBadge
                      key={item.medal.id}
                      userId={flairUserId}
                      forceMedalId={item.medal.id}
                      size="xs"
                      showTooltip
                    />
                  ) : null,
                )}
                {isOwner && mode === 'edit' ? (
                  <button
                    type="button"
                    className={styles.editMedalsButton}
                    onClick={() => setIsTopMedalsModalOpen(true)}
                    aria-label={t('badges.topMedals.edit', 'Change top medals')}
                    title={t('badges.topMedals.edit', 'Change top medals')}
                  >
                    <SlidersHorizontal size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </span>
            ) : isOwner && mode === 'edit' ? (
              <button
                type="button"
                className={styles.editMedalsButton}
                onClick={() => setIsTopMedalsModalOpen(true)}
              >
                <SlidersHorizontal size={15} aria-hidden="true" />
                {t('badges.topMedals.edit', 'Choose top medals')}
              </button>
            ) : null}
            {isEmptyProfile && isOwner ? (
              <span className={styles.emptyBadge}>{t('profile.emptyBadge', 'Profile not yet configured')}</span>
            ) : null}
          </p>
          {isOwner ? (
            <p className={styles.identityEmail} data-testid="profile-display-email">
              {displayEmail}
            </p>
          ) : null}
          <div className={styles.followRow}>
            <button
              type="button"
              className={styles.followLink}
              onClick={() => {
                setFollowModalTab('followers');
                setIsFollowModalOpen(true);
              }}
              title={t('profile.viewFollowersTitle', 'View your followers')}
            >
              <strong>{followersCount}</strong> {t('profile.followers', 'Followers')}
            </button>
            <span className={styles.followDot} aria-hidden>·</span>
            <button
              type="button"
              className={styles.followLink}
              onClick={() => {
                setFollowModalTab('following');
                setIsFollowModalOpen(true);
              }}
              title={t('profile.viewFollowingTitle', 'View people you follow')}
            >
              <strong>{followingCount}</strong> {t('profile.following', 'Following')}
            </button>
          </div>
        </div>
      </section>
      ) : null}

      <TopMedalsModal
        isOpen={isTopMedalsModalOpen}
        medals={unlockedMedals}
        selectedIds={selectedTopMedalIds}
        onClose={() => setIsTopMedalsModalOpen(false)}
        onSave={handleTopMedalsSave}
      />

      {isOwner && isOrcidEligibleRole(roleName) && (
        <OrcidIdentityPanel required={roleName === 'Reviewer'} />
      )}

      {/* FE_TRIAL_FLOW — 7-day Researcher / Lecturer trial countdown.
          Reads the BE-supplied `trialExpiryAt` from the auth user blob so
          the countdown survives a page reload without an extra API call.
          Rendered only for the owner; visitors never see trial chrome. */}
      {isOwner ? (
        <TrialCountdownCard
          trialExpiryAt={user?.trialExpiryAt ?? null}
          roleName={roleName}
        />
      ) : null}

      {showSuccess && (
        <div data-testid="profile-success-banner">
          <ErrorBanner
            tone="info"
            title={t('profile.profileUpdated', 'Profile updated')}
            message={t('profile.profileUpdatedMessage', 'Your academic profile is saved. Other users will see the updated details on your next interaction.')}
          />
        </div>
      )}

      {roleRequestSuccessMessage && (
        <div data-testid="profile-role-request-success-banner">
          <ErrorBanner
            tone="info"
            title={t('common.success', 'Success')}
            message={roleRequestSuccessMessage}
          />
        </div>
      )}

      {saveError && mode === 'edit' && (
        <div data-testid="profile-save-error-banner">
          <ErrorBanner
            tone="error"
            title={t('profile.saveErrorTitle', "We couldn't save your changes")}
            message={saveError.message}
          />
        </div>
      )}

      {error && profile && (
        <div data-testid="profile-refresh-error-banner">
          <ErrorBanner
            tone="warning"
            title={t('profile.refreshErrorTitle', 'Refresh failed')}
            message={t('profile.refreshErrorMessage', 'Showing the last cached profile. {message}').replace('{message}', error.message)}
          />
        </div>
      )}

      {mode === 'edit' ? (
        // Edit form replaces all tab content so the owner can't navigate
        // away mid-edit. The tabs strip is hidden below in edit mode too.
        <ProfileEditForm
          draft={draft}
          errors={validationErrors}
          isSaving={isSaving}
          hasChanges={hasChanges}
          hasValidationErrors={hasValidationErrors}
          keywordDraft={keywordDraft}
          flairMedalId={flairMedalId}
          flairOrder={flairOrder}
          authenticatedUserId={authenticatedUserId ?? 0}
          onChange={handleFieldChange}
          onKeywordDraftChange={setKeywordDraft}
          onKeywordKeyDown={handleKeywordKeyDown}
          onAddKeyword={handleAddKeyword}
          onRemoveKeyword={handleRemoveKeyword}
          onFlairChange={handleFlairChange}
          onSubmit={handleSave}
          onCancel={handleCancelEdit}
        />
      ) : null}

      {/* Phase 3 — Two-tab profile strip (Account / Public). The identity
          card / banners / ORCID panel / trial countdown stay mounted
          above the tabs so they read as the profile's "masthead"; the tabs
          swap the body content below. Edit mode above replaces the tabs
          entirely so the owner can't navigate away mid-edit.

          The public tab is visible to both owner and visitor; the account
          tab is owner-only and the strip hides it automatically when
          `!isOwner`. The merged Profile + Professional Profile content
          (research expertise + academic metrics) now lives inside the
          account panel so the owner never has to switch tabs to manage
          their full identity. */}
      {targetUserId && mode === 'view' ? (
        <>
          {/* Tab nav is owner-only. Visitors only have access to the
              public surface, so the "Profile & Expertise / Public
              Profile" tab strip is redundant for them and would imply
              they can switch into the private account panel. */}
          {isOwner ? (
            <ProfileSectionTabs
              activeTab={activeTab}
              onChange={setActiveTab}
              badgeCount={unlockedBadgeCount}
            />
          ) : null}

          {/* ── Account tab (owner only) ─────────────────────────
              Owner's private surface: account contact strip + the
              full ProfileView (which includes the owner-only phone /
              address / DOB / gender columns) + research expertise +
              academic metrics for role-eligible owners. The Edit
              button on the page header flips `mode` to 'edit' and
              replaces this panel with the ProfileEditForm above. */}
          <section
            id="profile-tabpanel-account"
            role="tabpanel"
            hidden={activeTab !== 'account'}
            data-testid="profile-tabpanel-account"
          >
            {activeTab === 'account' && isOwner ? (
              <>
                <AccountContactStrip
                  savedDraft={savedDraft}
                  displayEmail={displayEmail}
                />
                <ProfileView
                  draft={savedDraft}
                  updatedAt={profile?.updatedAt}
                  isEmpty={isEmptyProfile}
                  profile={profile}
                  isOwner={isOwner}
                />
                <InlineNotice
                  tone="info"
                  title={t('profile.edit.lockedFieldsTitle', 'Edit access')}
                  description={t('profile.edit.lockedFieldsHint')}
                />
                {isEligibleProfessionalRole ? (
                  <ProfessionalExcellenceSection
                    professionalProfile={professionalProfile}
                    isProfLoading={isProfLoading}
                    profError={profError}
                    onRetry={handleExpertiseRetry}
                    isRetrying={isExpertiseRetrying}
                    reviewerIsAvailable={reviewerIsAvailable}
                    isAvailLoading={isAvailLoading}
                    roleKey={roleName === 'Researcher' || roleName === 'Reviewer' || roleName === 'Lecturer' ? roleName : 'Reviewer'}
                    majorFields={majorFields}
                    isMajorsLoading={isMajorsLoading}
                    subFields={subFields}
                    isSubsLoading={isSubsLoading}
                    selectedMajorId={selectedMajorId}
                    selectedSubId={selectedSubId}
                    onMajorChange={handleMajorChange}
                    onSubChange={handleSubChange}
                    onSaveExpertise={handleSaveExpertise}
                    isExpertiseValid={isExpertiseValid}
                    hasExpertiseChanged={hasExpertiseChanged}
                    isSubmittingExpertise={isSubmittingExpertise}
                    expertiseFeedback={expertiseFeedback}
                    lastMetricsRefresh={lastMetricsRefresh}
                  />
                ) : null}
              </>
            ) : null}
          </section>

          {/* ── Public tab (everyone) ────────────────────────────
              Visitors land here by default; owners use it to preview
              what other users see. The AccountContactStrip is
              intentionally NOT rendered here — the public surface
              never reveals private contact details. */}
          <section
            id="profile-tabpanel-public"
            role="tabpanel"
            hidden={activeTab !== 'public'}
            data-testid="profile-tabpanel-public"
          >
            {activeTab === 'public' ? (
              <>
                {roleName === 'Reviewer' ? (
                  <ReviewerPublicView
                    data={publicProfileData}
                    displayName={displayName}
                    avatarUrl={avatarUrl}
                    avatarInitials={avatarInitials}
                    topMedals={selectedTopMedals}
                    showPrivacyFootnote={!isOwner}
                    isOwner={isOwner}
                  />
                ) : null}
                {roleName === 'Researcher' ? (
                  <ResearcherPublicView
                    data={publicProfileData}
                    displayName={displayName}
                    avatarUrl={avatarUrl}
                    avatarInitials={avatarInitials}
                    topMedals={selectedTopMedals}
                    showPrivacyFootnote={!isOwner}
                    isOwner={isOwner}
                  />
                ) : null}
                {roleName === 'Lecturer' ? (
                  <LecturerPublicView
                    data={publicProfileData}
                    displayName={displayName}
                    avatarUrl={avatarUrl}
                    avatarInitials={avatarInitials}
                    topMedals={selectedTopMedals}
                    showPrivacyFootnote={!isOwner}
                    locale={locale ?? 'en'}
                  />
                ) : null}
                {roleName === 'Graduate Student' ? (
                  <GraduateStudentPublicView
                    data={publicProfileData}
                    displayName={displayName}
                    avatarUrl={avatarUrl}
                    avatarInitials={avatarInitials}
                    topMedals={selectedTopMedals}
                    showPrivacyFootnote={!isOwner}
                    isOwner={isOwner}
                  />
                ) : null}
                {/* Fallback for Admin or unknown roles — keep the
                    original view. We force `isOwner={false}` so private
                    contact columns never leak into the public surface. */}
                {roleName === 'Admin' || !roleName ? (
                  <ProfileView
                    draft={savedDraft}
                    updatedAt={profile?.updatedAt}
                    isEmpty={isEmptyProfile}
                    profile={profile}
                    isOwner={false}
                  />
                ) : null}

                {/* Publications + Forum sections.
                    The role-specific public views (Researcher, Reviewer,
                    Graduate Student) each render their own copy of
                    `ProfilePublicationsSection` and `ProfileForumSection`
                    from inside `data.extras`, so rendering them again
                    here would produce duplicate sections. We therefore
                    gate the parent-level render on roles whose public
                    view does NOT surface these sections:
                      - Lecturer: no publications/forum in LecturerPublicView
                      - Admin / unknown / fallback: no public view at all
                    Researcher / Reviewer / Graduate Student each own their
                    own copy of these sections inside their public view. */}
                {(roleName === 'Lecturer' || roleName === 'Admin' || !roleName) ? (
                  <>
                    <ProfilePublicationsSection
                      publications={publications}
                      isLoading={isExtrasLoading}
                      error={extrasError}
                      isOwner={isOwner}
                    />
                    <ProfileForumSection
                      posts={forumPosts}
                      isLoading={isExtrasLoading}
                      error={extrasError}
                      isOwner={isOwner}
                    />
                  </>
                ) : null}
                <ProfileBadgesSection
                  userId={targetUserId}
                  isOwner={isOwner}
                  medals={unlockedMedals}
                />
              </>
            ) : null}
          </section>
        </>
      ) : null}

      {targetUserId && (
        <FollowListModal
          isOpen={isFollowModalOpen}
          initialTab={followModalTab}
          userId={targetUserId}
          onClose={() => setIsFollowModalOpen(false)}
          onCountsChanged={refetchCounts}
        />
      )}

      {isOwner && (
        <AvatarPickerModal
          isOpen={isAvatarPickerOpen}
          currentUrl={avatarUrl}
          userId={authenticatedUserId ?? 0}
          onClose={() => setIsAvatarPickerOpen(false)}
          onSave={async (url) => {
            try {
              await handleAvatarSave(url);
            } catch (saveError) {
              setAvatarError(saveError instanceof Error ? saveError.message : t('profile.avatar.saveFailed', 'Could not update avatar.'));
              throw saveError;
            }
          }}
        />
      )}

      {canRequestAdditionalRole && (
        <RequestAdditionalRoleModal
          isOpen={isRoleRequestModalOpen}
          onClose={() => setIsRoleRequestModalOpen(false)}
          currentUser={user}
          currentProfile={{
            institution: profile?.institution ?? draft.institution,
            department: null,
            phoneNumber: profile?.phoneNumber ?? draft.phoneNumber,
            orcidId: profile?.orcidId ?? null,
            fullName: profile?.fullName ?? draft.fullName,
          }}
          onSubmitted={() => {
            if (user?.userId) {
              setPendingRoleRequest(roleRequestService.getPendingRequest(user.userId));
              roleRequestService.fetchPendingRequest(user.userId).then((fresh) => {
                setPendingRoleRequest(fresh);
              });
            }
            void refetch();
            setRoleRequestSuccessMessage(
              t(
                'profile.requestRoleSuccess',
                'Your request to add role has been submitted and is pending administrator review.',
              ),
            );
          }}
        />
      )}
    </div>
  );
};

/** Account contact strip — owner-only, shown above the role-specific public view.
 *  Visitors never see these fields. Shows phone, address, DOB, gender, email.
 */
interface AccountContactStripProps {
  savedDraft: DraftFields;
  displayEmail: string;
}

const AccountContactStrip = ({
  savedDraft,
  displayEmail,
}: AccountContactStripProps) => {
  const { t } = useI18n();
  return (
    <section className={styles.accountStrip} aria-label="Account contact information">
      <dl className={styles.accountStripGrid}>
        {displayEmail ? (
          <div className={styles.accountStripField}>
            <dt>{t('profile.accountContact.email', 'Email')}</dt>
            <dd>{displayEmail}</dd>
          </div>
        ) : null}
        {savedDraft.phoneNumber?.trim() ? (
          <div className={styles.accountStripField}>
            <dt>{t('profile.accountContact.phone', 'Phone')}</dt>
            <dd>{savedDraft.phoneNumber}</dd>
          </div>
        ) : null}
        {savedDraft.address?.trim() ? (
          <div className={styles.accountStripField}>
            <dt>{t('profile.accountContact.address', 'Address')}</dt>
            <dd>{savedDraft.address}</dd>
          </div>
        ) : null}
        {savedDraft.dateOfBirth?.trim() ? (
          <div className={styles.accountStripField}>
            <dt>{t('profile.accountContact.dob', 'Date of birth')}</dt>
            <dd>{formatDisplayDate(savedDraft.dateOfBirth)}</dd>
          </div>
        ) : null}
        {savedDraft.gender?.trim() ? (
          <div className={styles.accountStripField}>
            <dt>{t('profile.accountContact.gender', 'Gender')}</dt>
            <dd>
              {isGenderCode(savedDraft.gender)
                ? t(
                    `profile.view.genderLabel.${savedDraft.gender}`,
                    GENDER_LABEL_FALLBACK[savedDraft.gender] ?? savedDraft.gender,
                  )
                : savedDraft.gender}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
};

interface ProfileViewProps {
  draft: DraftFields;
  updatedAt: string | null | undefined;
  isEmpty: boolean;
  profile?: ProfileDto | null;
  isOwner: boolean;
}

const ProfileView = ({ draft, updatedAt, isEmpty, profile, isOwner }: ProfileViewProps) => {
  const { t } = useI18n();
  const showValue = (value: string, fallback?: string) =>
    value.trim() === '' ? <span className={styles.viewEmpty}>{fallback ?? t('profile.view.notSet', 'Not set')}</span> : value;

  return (
    <section className={styles.viewCard} aria-labelledby="profile-view-title">
      <div className={styles.formHeader}>
        <h2 id="profile-view-title" className={styles.formTitle}>
          {t('profile.view.title', 'Profile details')}
        </h2>
        <p className={styles.formSubtitle}>
          {t('profile.view.subtitle', 'The information other users see across the ARS platform.')}{' '}
          {isEmpty ? t('profile.view.emptyHint', 'You haven\u2019t filled out your profile yet — use "Edit profile" to get started.') : null}
        </p>
      </div>

      <div className={styles.viewGrid}>
        <div className={styles.viewItem}>
          <span className={styles.viewLabel}>{t('profile.view.fullName', 'Full name')}</span>
          <p className={styles.viewValue} data-testid="view-full-name">
            {showValue(draft.fullName)}
          </p>
        </div>
        <div className={styles.viewItem}>
          <span className={styles.viewLabel}>{t('profile.view.academicTitle', 'Academic title')}</span>
          <p className={styles.viewValue} data-testid="view-academic-title">
            {showValue(draft.academicTitle)}
          </p>
        </div>
        <div className={styles.viewItem}>
          <span className={styles.viewLabel}>{t('profile.view.institution', 'Institution')}</span>
          <p className={styles.viewValue} data-testid="view-institution">
            {showValue(draft.institution)}
          </p>
        </div>
        {isOwner ? (
          <>
            <div className={styles.viewItem}>
              <span className={styles.viewLabel}>{t('profile.view.phone', 'Phone number')}</span>
              <p className={styles.viewValue} data-testid="view-phone-number">
                {showValue(draft.phoneNumber)}
              </p>
            </div>
            <div className={styles.viewItem}>
              <span className={styles.viewLabel}>{t('profile.view.dob', 'Date of birth')}</span>
              <p className={styles.viewValue} data-testid="view-date-of-birth">
                {draft.dateOfBirth ? formatDisplayDate(draft.dateOfBirth) : t('profile.view.dash', '—')}
              </p>
            </div>
            <div className={styles.viewItem}>
              <span className={styles.viewLabel}>{t('profile.view.gender', 'Gender')}</span>
              <p className={styles.viewValue} data-testid="view-gender">
                {isGenderCode(draft.gender)
                  ? t(
                      `profile.view.genderLabel.${draft.gender}`,
                      GENDER_LABEL_FALLBACK[draft.gender] ?? draft.gender,
                    )
                  : showValue(draft.gender)}
              </p>
            </div>
            <div className={styles.viewItem}>
              <span className={styles.viewLabel}>{t('profile.view.address', 'Address')}</span>
              <p className={styles.viewValue} data-testid="view-address">
                {showValue(draft.address)}
              </p>
            </div>
          </>
        ) : null}
        <div className={`${styles.viewItem} ${styles.viewGridFull}`}>
          <span className={styles.viewLabel}>{t('profile.view.bio', 'Bio')}</span>
          <p className={styles.viewValue} data-testid="view-bio">
            {showValue(draft.bio, t('profile.view.bioEmpty', 'No bio yet.'))}
          </p>
        </div>
        <div className={`${styles.viewItem} ${styles.viewGridFull}`}>
          <span className={styles.viewLabel}>{t('profile.view.keywords', 'Research interest keywords')}</span>
          {draft.keywords.length === 0 ? (
            <p className={styles.viewValue}>
              <span className={styles.viewEmpty}>{t('profile.view.keywordsEmpty', 'No keywords yet.')}</span>
            </p>
          ) : (
            <div className={styles.keywordChipList} data-testid="view-keywords">
              {draft.keywords.map((kw) => (
                <span key={kw} className={styles.keywordChipStatic}>
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
        {profile?.hindex != null || profile?.totalCitations != null || profile?.publicationCount != null || profile?.majorFieldName ? (
          <div className={`${styles.viewItem} ${styles.viewGridFull}`}>
            <span className={styles.viewLabel}>{t('profile.view.metricsTitle', 'Academic & Research Metrics')}</span>
            <div className={styles.metricsRow}>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>{t('profile.view.hIndex', 'H-Index')}</span>
                <strong className={styles.metricValue}>{profile.hindex ?? 0}</strong>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>{t('profile.view.citations', 'Citations')}</span>
                <strong className={styles.metricValue}>{profile.totalCitations ?? 0}</strong>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>{t('profile.view.publications', 'Publications')}</span>
                <strong className={styles.metricValue}>{profile.publicationCount ?? 0}</strong>
              </div>
              {profile.majorFieldName && (
                <div className={`${styles.metric} ${styles.metricWide}`}>
                  <span className={styles.metricLabel}>{t('profile.view.researchField', 'Research Field')}</span>
                  <strong className={styles.metricValueLg}>{profile.majorFieldName}</strong>
                  {profile.subFieldName && (
                    <span className={styles.metricSubValue}>{profile.subFieldName}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
        {updatedAt ? (
          <div className={`${styles.viewItem} ${styles.viewGridFull}`}>
            <span className={styles.viewLabel}>{t('profile.view.lastUpdated', 'Last updated')}</span>
            <p className={styles.viewValue}>{formatDate(updatedAt)}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
};

interface ProfileEditFormProps {
  draft: DraftFields;
  errors: Partial<Record<keyof DraftFields, string>>;
  isSaving: boolean;
  hasChanges: boolean;
  hasValidationErrors: boolean;
  keywordDraft: string;
  flairMedalId: string | null;
  flairOrder: string[];
  /** Authenticated user id — used to scope the FeaturedFlairPicker's localStorage key. */
  authenticatedUserId: number;
  onChange: <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => void;
  onKeywordDraftChange: (value: string) => void;
  onKeywordKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (kw: string) => void;
  onFlairChange: (next: { flairMedalId: string | null; flairOrder: string[] }) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

const ProfileEditForm = ({
  draft,
  errors,
  isSaving,
  hasChanges,
  hasValidationErrors,
  keywordDraft,
  flairMedalId,
  flairOrder,
  authenticatedUserId,
  onChange,
  onKeywordDraftChange,
  onKeywordKeyDown,
  onAddKeyword,
  onRemoveKeyword,
  onFlairChange,
  onSubmit,
  onCancel,
}: ProfileEditFormProps) => {
  const { t } = useI18n();
  const fieldError = (key: keyof DraftFields) => errors[key];
  const fieldProps = (key: keyof DraftFields) => ({
    'aria-invalid': fieldError(key) ? true : undefined,
    'aria-describedby': fieldError(key) ? `${key}-error` : undefined,
  });

  return (
    <form className={styles.formCard} onSubmit={onSubmit} aria-labelledby="profile-edit-title" noValidate>
      <div className={styles.formHeader}>
        <h2 id="profile-edit-title" className={styles.formTitle}>
          {t('profile.edit.title', 'Edit your profile')}
        </h2>
        <p className={styles.formSubtitle}>
          {t('profile.edit.subtitle', 'Update the fields below. Only the fields you change are sent to the server.')}
        </p>
      </div>

      <div className={styles.formGrid}>
        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label} htmlFor="full-name-input">
            {t('profile.view.fullName', 'Full name')} <span className={styles.requiredStar} aria-hidden="true">*</span>
            <span className={styles.lockedFieldBadge} aria-hidden="true">
              {t('profile.edit.lockedFieldHint', 'Requires admin approval')}
            </span>
          </label>
          <input
            id="full-name-input"
            data-testid="profile-input-full-name"
            className={`${styles.input} ${styles.inputLocked}`}
            type="text"
            value={draft.fullName}
            readOnly
            aria-readonly="true"
            onChange={(event) => onChange('fullName', event.target.value)}
            maxLength={PROFILE_VALIDATION.fullName.maxLength}
            title={t('profile.edit.lockedFieldTitle', 'This field requires admin approval to change.')}
            {...fieldProps('fullName')}
          />
          <span className={styles.lockedFieldHint}>
            {t('profile.edit.lockedFieldHint', 'Requires admin approval')}
          </span>
          {fieldError('fullName') ? (
            <span className={styles.fieldError} id="full-name-error" data-testid="profile-error-full-name">
              {fieldError('fullName')}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="academic-title-input">
            {t('profile.view.academicTitle', 'Academic title')}
            <span className={styles.lockedFieldBadge} aria-hidden="true">
              {t('profile.edit.lockedFieldHint', 'Requires admin approval')}
            </span>
          </label>
          <input
            id="academic-title-input"
            data-testid="profile-input-academic-title"
            className={`${styles.input} ${styles.inputLocked}`}
            type="text"
            value={draft.academicTitle}
            readOnly
            aria-readonly="true"
            onChange={(event) => onChange('academicTitle', event.target.value)}
            maxLength={PROFILE_VALIDATION.academicTitle.maxLength}
            title={t('profile.edit.lockedFieldTitle', 'This field requires admin approval to change.')}
            {...fieldProps('academicTitle')}
          />
          <span className={styles.lockedFieldHint}>
            {t('profile.edit.lockedFieldHint', 'Requires admin approval')}
          </span>
          {fieldError('academicTitle') ? (
            <span className={styles.fieldError} id="academic-title-error">
              {fieldError('academicTitle')}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="avatar-initials-input">
            {t('profile.view.avatarInitials', 'Avatar initials')}
          </label>
          <input
            id="avatar-initials-input"
            data-testid="profile-input-avatar-initials"
            className={styles.input}
            type="text"
            value={draft.avatarInitials}
            onChange={(event) => onChange('avatarInitials', event.target.value)}
            maxLength={PROFILE_VALIDATION.avatarInitials.maxLength}
            placeholder={t('profile.edit.avatarInitialsExample', 'e.g. ND')}
            {...fieldProps('avatarInitials')}
          />
          {fieldError('avatarInitials') ? (
            <span className={styles.fieldError} id="avatar-initials-error">
              {fieldError('avatarInitials')}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="institution-input">
            {t('profile.edit.institutionLabel', 'Institution / University')}
            <span className={styles.lockedFieldBadge} aria-hidden="true">
              {t('profile.edit.lockedFieldHint', 'Requires admin approval')}
            </span>
          </label>
          <input
            id="institution-input"
            data-testid="profile-input-institution"
            className={`${styles.input} ${styles.inputLocked}`}
            type="text"
            value={draft.institution}
            readOnly
            aria-readonly="true"
            onChange={(event) => onChange('institution', event.target.value)}
            maxLength={PROFILE_VALIDATION.institution.maxLength}
            title={t('profile.edit.lockedFieldTitle', 'This field requires admin approval to change.')}
            {...fieldProps('institution')}
          />
          <span className={styles.lockedFieldHint}>
            {t('profile.edit.lockedFieldHint', 'Requires admin approval')}
          </span>
          {fieldError('institution') ? (
            <span className={styles.fieldError} id="institution-error">
              {fieldError('institution')}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="phone-input">
            {t('profile.view.phone', 'Phone number')}
          </label>
          <input
            id="phone-input"
            data-testid="profile-input-phone"
            className={styles.input}
            type="tel"
            value={draft.phoneNumber}
            onChange={(event) => onChange('phoneNumber', event.target.value)}
            maxLength={PROFILE_VALIDATION.phoneNumber.maxLength}
            placeholder={t('profile.edit.phonePlaceholder', '+84 …')}
            {...fieldProps('phoneNumber')}
          />
          {fieldError('phoneNumber') ? (
            <span className={styles.fieldError} id="phone-error">
              {fieldError('phoneNumber')}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="dob-input">
            {t('profile.view.dob', 'Date of birth')}
          </label>
          <input
            id="dob-input"
            data-testid="profile-input-dob"
            className={styles.input}
            type="date"
            value={draft.dateOfBirth}
            onChange={(event) => onChange('dateOfBirth', event.target.value)}
            {...fieldProps('dateOfBirth')}
          />
          {fieldError('dateOfBirth') ? (
            <span className={styles.fieldError} id="dob-error">
              {fieldError('dateOfBirth')}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="gender-input">
            {t('profile.view.gender', 'Gender')}
          </label>
          <select
            id="gender-input"
            data-testid="profile-input-gender"
            className={`${styles.input} ${styles.select}`}
            value={draft.gender}
            onChange={(event) => onChange('gender', event.target.value)}
            {...fieldProps('gender')}
          >
            <option value="">
              {t('profile.edit.gender.placeholder', '— Select —')}
            </option>
            {GENDER_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {t(
                  `profile.edit.gender.options.${option.labelKey}`,
                  // English fallback so a partially-translated dictionary
                  // still surfaces sensible copy.
                  GENDER_LABEL_FALLBACK[option.code] ?? option.code,
                )}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label} htmlFor="address-input">
            {t('profile.view.address', 'Address')}
          </label>
          <input
            id="address-input"
            data-testid="profile-input-address"
            className={styles.input}
            type="text"
            value={draft.address}
            onChange={(event) => onChange('address', event.target.value)}
            maxLength={PROFILE_VALIDATION.address.maxLength}
            {...fieldProps('address')}
          />
          {fieldError('address') ? (
            <span className={styles.fieldError} id="address-error">
              {fieldError('address')}
            </span>
          ) : null}
        </div>

        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label} htmlFor="keywords-input">
            {t('profile.view.keywords', 'Research interest keywords')}
          </label>
          <div className={styles.keywordBox}>
            <div className={styles.keywordInputRow}>
              <input
                id="keywords-input"
                data-testid="profile-input-keyword"
                className={styles.keywordInput}
                type="text"
                value={keywordDraft}
                onChange={(event) => onKeywordDraftChange(event.target.value)}
                onKeyDown={onKeywordKeyDown}
                placeholder={t('profile.edit.keywordPlaceholder', 'Type a keyword and press Enter')}
              />
              <button
                type="button"
                className={styles.keywordAddBtn}
                onClick={onAddKeyword}
                disabled={keywordDraft.trim() === ''}
                data-testid="profile-add-keyword-button"
              >
                {t('profile.edit.keywordAdd', 'Add')}
              </button>
            </div>
            {draft.keywords.length === 0 ? (
              <p className={styles.keywordEmpty}>
                {t('profile.edit.keywordsEmpty', 'No keywords yet. Add a few to help researchers find your work.')}
              </p>
            ) : (
              <div className={styles.keywordChips} data-testid="profile-keyword-chips">
                {draft.keywords.map((kw) => (
                  <span key={kw} className={styles.keywordChip}>
                    {kw}
                    <button
                      type="button"
                      className={styles.keywordRemoveBtn}
                      onClick={() => onRemoveKeyword(kw)}
                      aria-label={t('profile.edit.removeKeywordAria', 'Remove keyword {keyword}').replace('{keyword}', kw)}
                      data-testid={`profile-remove-keyword-${kw}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {fieldError('keywords') ? (
            <span className={styles.fieldError} id="keywords-error">
              {fieldError('keywords')}
            </span>
          ) : null}
        </div>

        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label} htmlFor="bio-input">
            {t('profile.edit.bioLabel', 'Biography')}
          </label>
          <textarea
            id="bio-input"
            data-testid="profile-input-bio"
            className={styles.textarea}
            value={draft.bio}
            onChange={(event) => onChange('bio', event.target.value)}
            maxLength={PROFILE_VALIDATION.bio.maxLength}
            rows={5}
            {...fieldProps('bio')}
          />
          {fieldError('bio') ? (
            <span className={styles.fieldError} id="bio-error">
              {fieldError('bio')}
            </span>
          ) : null}
        </div>
      </div>

      {/* Phase 2.5 — Featured flair picker (Reddit-style). Sits below
          the keyword chips and above the action bar so it's the last
          thing the user sees before Save. */}
      <FeaturedFlairPicker
        userId={authenticatedUserId}
        valueFlairMedalId={flairMedalId}
        valueFlairOrder={flairOrder}
        onChange={onFlairChange}
      />

      <div className={styles.formActions}>
        <span className={styles.formActionsHint}>
          {hasValidationErrors
            ? t('profile.edit.formActionsHint.invalid', 'Fix the highlighted fields to continue.')
            : hasChanges
              ? t('profile.edit.formActionsHint.unsaved', 'Unsaved changes.')
              : t('profile.edit.formActionsHint.unchanged', 'No changes to save.')}
        </span>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onCancel}
          disabled={isSaving}
          data-testid="profile-cancel-button"
        >
          {t('profile.edit.cancel', 'Cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isSaving || hasValidationErrors || !hasChanges}
          data-testid="profile-save-button"
          isLoading={isSaving}
        >
          {t('profile.edit.save', 'Save changes')}
        </Button>
      </div>
    </form>
  );
};

// ── Trial countdown card ──────────────────────────────────────────────────
//
// Renders the BE-supplied 7-day Researcher / Lecturer trial. The card is
// only mounted when the user is authenticated and owns the profile (the
// Profile page is responsible for that gate).
//
// Visual hierarchy (Operate mode):
//   1. Eyebrow: "TRIAL ACTIVE" / "TRIAL ENDED"
//   2. Headline: day count and label ("5 days remaining", "Trial ends today")
//   3. Progress bar: 7-day window, fills as days elapse. Right rail.
//   4. Footer: expiry date + role line + subtle hint about what happens
//      when the trial expires (the BE handles the actual flip to ACTIVE).
//
// Design tokens: Paper Day warm surfaces, near-black ink, accent primary
// for the day-count and progress bar fill. The card keeps `--profile-accent`
// as a fallback so the visual links back to the role-accent bar above.
// ── Professional Excellence (merged tab body) ───────────────────────────────
//
// Renders the Research Expertise form + Academic Metrics grid that used to
// live behind the dedicated "Professional Profile" tab. After the merge,
// this section lives inside the Account tab so the owner sees the same
// personal details, research expertise, and metrics in a single unified
// surface.
//
// State is fully controlled by the parent Profile page — the 14-day
// auto-refresh timer is wired there so the metrics don't refetch on every
// render and the timer survives tab / edit-mode toggles.

type ExcellenceRoleKey = 'Researcher' | 'Reviewer' | 'Lecturer';

interface ExcellenceRoleSurfaceConfig {
  eyebrow: string;
  badgeLabel: string;
  accentVar: string;
  accentMidVar: string;
  accentLightVar: string;
  showAvailability: boolean;
  showAcademicMetrics: boolean;
  expertiseHeading: string;
  expertiseSubheading: string;
  saveButtonLabel: string;
}

const buildExcellenceRoleConfig = (
  t: (key: string, fallback?: string) => string,
): Record<ExcellenceRoleKey, ExcellenceRoleSurfaceConfig> => ({
  Reviewer: {
    eyebrow: t('profile.professional.eyebrow.reviewer'),
    badgeLabel: t('common.role.Reviewer'),
    accentVar: 'var(--ars-reviewer, #065f46)',
    accentMidVar: 'var(--ars-reviewer-mid, #047857)',
    accentLightVar: 'var(--ars-reviewer-light, #d1fae5)',
    showAvailability: true,
    showAcademicMetrics: true,
    expertiseHeading: t('profile.professional.expertise.heading'),
    expertiseSubheading: t('profile.professional.expertise.subheading.reviewer'),
    saveButtonLabel: t('profile.professional.saveExpertise'),
  },
  Researcher: {
    eyebrow: t('profile.professional.eyebrow.researcher'),
    badgeLabel: t('common.role.Researcher'),
    accentVar: 'var(--ars-researcher, #b45309)',
    accentMidVar: 'var(--ars-researcher-mid, #d97706)',
    accentLightVar: 'var(--ars-researcher-light, #fef3c7)',
    showAvailability: false,
    showAcademicMetrics: true,
    expertiseHeading: t('profile.professional.expertise.heading'),
    expertiseSubheading: t('profile.professional.expertise.subheading.researcher'),
    saveButtonLabel: t('profile.professional.saveExpertise'),
  },
  Lecturer: {
    eyebrow: t('profile.professional.eyebrow.lecturer'),
    badgeLabel: t('common.role.Lecturer'),
    accentVar: 'var(--ars-lecturer, #7c2d12)',
    accentMidVar: 'var(--ars-lecturer-mid, #9a3412)',
    accentLightVar: 'var(--ars-lecturer-light, #fef2f2)',
    showAvailability: false,
    showAcademicMetrics: false,
    expertiseHeading: t('profile.professional.expertise.heading'),
    expertiseSubheading: t('profile.professional.expertise.subheading.lecturer'),
    saveButtonLabel: t('profile.professional.saveExpertise'),
  },
});

interface ProfessionalExcellenceSectionProps {
  professionalProfile: ReviewerProfile | null;
  isProfLoading: boolean;
  profError: Error | null;
  onRetry: () => Promise<void> | void;
  isRetrying: boolean;
  reviewerIsAvailable: boolean | null;
  isAvailLoading: boolean;
  roleKey: ExcellenceRoleKey;
  majorFields: MajorField[];
  isMajorsLoading: boolean;
  subFields: SubField[];
  isSubsLoading: boolean;
  selectedMajorId: number | null;
  selectedSubId: number | null;
  onMajorChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onSubChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onSaveExpertise: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isExpertiseValid: boolean;
  hasExpertiseChanged: boolean;
  isSubmittingExpertise: boolean;
  expertiseFeedback: { type: 'success' | 'error'; message: string } | null;
  lastMetricsRefresh: Date | null;
}

const formatDateSafe = (value: Date | null, locale: string): string => {
  if (!value) return '—';
  try {
    return value.toLocaleString(locale);
  } catch {
    return value.toLocaleString();
  }
};

const ProfessionalExcellenceSection = ({
  professionalProfile,
  isProfLoading,
  profError,
  onRetry,
  isRetrying,
  reviewerIsAvailable,
  isAvailLoading,
  roleKey,
  majorFields,
  isMajorsLoading,
  subFields,
  isSubsLoading,
  selectedMajorId,
  selectedSubId,
  onMajorChange,
  onSubChange,
  onSaveExpertise,
  isExpertiseValid,
  hasExpertiseChanged,
  isSubmittingExpertise,
  expertiseFeedback,
  lastMetricsRefresh,
}: ProfessionalExcellenceSectionProps) => {
  const { t, locale } = useI18n();
  const ROLE_CONFIG = useMemo(() => buildExcellenceRoleConfig(t), [t]);
  const roleConfig = ROLE_CONFIG[roleKey];

  const accentStyle = useMemo<CSSProperties>(
    () => ({
      ['--profile-accent' as string]: roleConfig.accentVar,
      ['--profile-accent-mid' as string]: roleConfig.accentMidVar,
      ['--profile-accent-light' as string]: roleConfig.accentLightVar,
    }),
    [roleConfig.accentVar, roleConfig.accentMidVar, roleConfig.accentLightVar],
  );

  if (isProfLoading) {
    return (
      <div className={professionalStyles.state} role="status" style={accentStyle}>
        {t('profile.professional.loading')}
      </div>
    );
  }

  if (profError || !professionalProfile) {
    return (
      <div className={professionalStyles.state} role="alert" style={accentStyle}>
        <p>{profError?.message ?? t('profile.professional.loadError')}</p>
        <button
          className={professionalStyles.primaryButton}
          onClick={() => {
            void onRetry();
          }}
          disabled={isRetrying}
          data-testid="profile-retry"
        >
          {isRetrying ? t('profile.professional.retrying') : t('profile.professional.retry')}
        </button>
      </div>
    );
  }

  const displayAvailability = !roleConfig.showAvailability
    ? '—'
    : isAvailLoading
      ? t('profile.professional.availability.checking')
      : reviewerIsAvailable === null
        ? t('profile.professional.availability.unavailable')
        : reviewerIsAvailable
          ? t('profile.professional.availability.available')
          : t('profile.professional.availability.unavailable');

  const detailRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: t('profile.professional.detail.orcid'), value: professionalProfile.orcidId ?? t('common.notSet') },
    { label: t('profile.professional.detail.sync'), value: professionalProfile.syncStatus ?? t('profile.professional.detail.notAvailable') },
  ];
  if (roleConfig.showAvailability) {
    detailRows.push({
      label: t('profile.professional.detail.availability'),
      value: (
        <span className={reviewerIsAvailable ? professionalStyles.statusAvailable : professionalStyles.statusUnavailable}>
          {displayAvailability}
        </span>
      ),
    });
  }

  return (
    <div className={professionalStyles.tabBody} style={accentStyle} data-role={roleKey}>
      <section className={professionalStyles.profileDetailsSection} aria-label={t('profile.professional.title')}>
        <dl className={professionalStyles.profileDetails}>
          {detailRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className={professionalStyles.expertiseSection}
        data-testid="research-expertise-section"
        aria-labelledby="research-expertise-title"
      >
        <div className={professionalStyles.sectionHeading}>
          <div>
            <p className={professionalStyles.eyebrow}>{t('profile.professional.expertise.eyebrow')}</p>
            <h2 id="research-expertise-title">{roleConfig.expertiseHeading}</h2>
            <p>{roleConfig.expertiseSubheading}</p>
          </div>
        </div>
        <form className={professionalStyles.expertiseForm} onSubmit={onSaveExpertise}>
          <div className={professionalStyles.formRow}>
            <div className={professionalStyles.formField}>
              <label htmlFor="major-field">{t('profile.professional.expertise.majorField')}</label>
              <select
                id="major-field"
                data-testid="major-field-select"
                value={selectedMajorId ?? ''}
                onChange={onMajorChange}
                disabled={isMajorsLoading}
              >
                <option value="">{t('profile.professional.expertise.selectMajor')}</option>
                {majorFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={professionalStyles.formField}>
              <label htmlFor="sub-field">{t('profile.professional.expertise.subfield')}</label>
              <select
                id="sub-field"
                data-testid="sub-field-select"
                value={selectedSubId ?? ''}
                onChange={onSubChange}
                disabled={selectedMajorId === null || isMajorsLoading || isSubsLoading}
              >
                <option value="">{t('profile.professional.expertise.selectSubfield')}</option>
                {subFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            className={professionalStyles.primaryButton}
            type="submit"
            data-testid="save-expertise-button"
            disabled={!isExpertiseValid || !hasExpertiseChanged || isSubmittingExpertise}
          >
            {isSubmittingExpertise ? t('profile.professional.expertise.saving') : roleConfig.saveButtonLabel}
          </button>
          {expertiseFeedback ? (
            <div
              className={expertiseFeedback.type === 'success' ? professionalStyles.successFeedback : professionalStyles.errorFeedback}
              role={expertiseFeedback.type === 'error' ? 'alert' : 'status'}
            >
              {expertiseFeedback.message}
            </div>
          ) : null}
        </form>
      </section>

      {roleConfig.showAcademicMetrics ? (
        <section
          className={professionalStyles.metricSection}
          data-testid="academic-metrics-section"
          aria-labelledby="academic-metrics-title"
        >
          <div className={professionalStyles.sectionHeading}>
            <div>
              <p className={professionalStyles.eyebrow}>{t('profile.professional.metrics.eyebrow')}</p>
              <h2 id="academic-metrics-title">{t('profile.professional.metrics.title')}</h2>
              <p>{t('profile.professional.metrics.refreshHint')}</p>
            </div>
            <span className={professionalStyles.lockLabel}>
              {t(
                'profile.professional.metrics.lastRefreshed',
                'Last refreshed: {time}',
                { time: formatDateSafe(lastMetricsRefresh, locale) },
              )}
            </span>
          </div>
          <div className={professionalStyles.metricGrid}>
            <article className={professionalStyles.metricCard} data-testid="metric-hindex">
              <span>{t('profile.professional.metrics.hindex')}</span>
              <strong>{professionalProfile.hindex ?? t('common.notSet')}</strong>
            </article>
            <article className={professionalStyles.metricCard} data-testid="metric-total-citations">
              <span>{t('profile.professional.metrics.totalCitations')}</span>
              <strong>{professionalProfile.totalCitations ?? t('common.notSet')}</strong>
            </article>
            <article className={professionalStyles.metricCard} data-testid="metric-publication-count">
              <span>{t('profile.professional.metrics.publicationCount')}</span>
              <strong>{professionalProfile.publicationCount ?? t('common.notSet')}</strong>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
};

// (professionalStyles is imported at the top of the file so this module
// remains ES-module-clean: every `import` declaration must precede any
// executable code or export.)

export default Profile;

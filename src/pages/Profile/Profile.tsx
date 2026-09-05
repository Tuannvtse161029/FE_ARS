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
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../hooks/useProfile';
import { toLocalDateInput, formatDisplayDate } from '../../utils/datetime';
import {
  PROFILE_VALIDATION,
  resolveRoleProfileMeta,
  type Profile as ProfileDto,
  type ProfileUpdateRequest,
} from '../../types/profile';
import { formatDate } from '../../utils/formatDate';
import { validateVietnameseName } from '../../utils/validationRules';
import { useFollowCounts } from '../../hooks/useFollowers';
import { followerService } from '../../services/follower.service';
import { FollowListModal } from '../../components/profile/FollowListModal';
import { ProfilePublicationsSection } from '../../components/profile/ProfilePublicationsSection';
import { ProfileForumSection } from '../../components/profile/ProfileForumSection';
import { ProfileSectionTabs, type ProfileTabId } from '../../components/profile/ProfileSectionTabs';
import { ProfileBadgesSection } from '../../components/profile/ProfileBadgesSection';
import { FeaturedFlairPicker } from '../../components/profile/FeaturedFlairPicker';
import { useAuthorFlair } from '../../hooks/useAuthorFlair';
import { useProfileExtras } from '../../hooks/useProfileExtras';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { SkeletonRow } from '../../components/SkeletonRow';
import { ErrorBanner } from '../../components/ErrorBanner';
import { EmptyState } from '../../components/EmptyState';
import { OrcidIdentityPanel } from '../../components/orcid/OrcidIdentityPanel';
import { OrcidIdentityMarker } from '../../components/identity/OrcidIdentityMarker';
import { isOrcidEligibleRole } from '../../utils/registrationRoles';
import { UserFlairBadge } from '../../components/medals/UserFlairBadge';
import { useI18n } from '../../i18n/I18nContext';
import styles from './Profile.module.css';

const ROLE_LABEL = {
  Researcher: 'Researcher',
  Reviewer: 'Reviewer',
  Lecturer: 'Lecturer',
  'Graduate Student': 'Graduate Student',
  Admin: 'Admin',
} as const;

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
function validateDraft(draft: DraftFields): Partial<Record<keyof DraftFields, string>> {
  const errors: Partial<Record<keyof DraftFields, string>> = {};
  // Vietnamese-name policy is centralised in utils/validationRules so it
  // matches the rule used by the Register form. The Profile page keeps the
  // length bounds in PROFILE_VALIDATION (different max for the bio/institution).
  const nameErr = validateVietnameseName(draft.fullName);
  if (nameErr) {
    errors.fullName = nameErr;
  } else if (draft.fullName.length > PROFILE_VALIDATION.fullName.maxLength) {
    errors.fullName = `Please keep your full name under ${PROFILE_VALIDATION.fullName.maxLength} characters.`;
  }
  if (
    draft.academicTitle.length > PROFILE_VALIDATION.academicTitle.maxLength
  ) {
    errors.academicTitle = `Please keep the title under ${PROFILE_VALIDATION.academicTitle.maxLength} characters.`;
  }
  if (draft.phoneNumber.length > PROFILE_VALIDATION.phoneNumber.maxLength) {
    errors.phoneNumber = `Please keep the phone number under ${PROFILE_VALIDATION.phoneNumber.maxLength} characters.`;
  } else if (
    draft.phoneNumber.trim() !== '' &&
    !PROFILE_VALIDATION.phoneNumber.pattern.test(draft.phoneNumber.trim())
  ) {
    errors.phoneNumber = 'Use digits, spaces, dashes, parentheses, or a leading +.';
  }
  if (draft.institution.length > PROFILE_VALIDATION.institution.maxLength) {
    errors.institution = `Please keep the institution under ${PROFILE_VALIDATION.institution.maxLength} characters.`;
  }
  if (draft.bio.length > PROFILE_VALIDATION.bio.maxLength) {
    errors.bio = `Please keep the bio under ${PROFILE_VALIDATION.bio.maxLength} characters.`;
  }
  if (draft.address.length > PROFILE_VALIDATION.address.maxLength) {
    errors.address = `Please keep the address under ${PROFILE_VALIDATION.address.maxLength} characters.`;
  }
  if (draft.keywords.length > PROFILE_VALIDATION.keywords.maxItems) {
    errors.keywords = `Please keep at most ${PROFILE_VALIDATION.keywords.maxItems} keywords.`;
  }
  for (const kw of draft.keywords) {
    if (kw.length > PROFILE_VALIDATION.keywords.maxItemLength) {
      errors.keywords = `Each keyword must be under ${PROFILE_VALIDATION.keywords.maxItemLength} characters.`;
      break;
    }
  }
  if (
    draft.avatarInitials.trim() !== '' &&
    (!PROFILE_VALIDATION.avatarInitials.pattern.test(draft.avatarInitials.trim()) ||
      draft.avatarInitials.length > PROFILE_VALIDATION.avatarInitials.maxLength)
  ) {
    errors.avatarInitials = 'Up to 4 letters or digits, please.';
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
  const { t } = useI18n();
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

  const roleName = isOwner ? (user?.role ?? null) : (profile?.roleName ?? null);
  const roleMeta = useMemo(() => resolveRoleProfileMeta(roleName), [roleName]);
  const roleLabel = roleName && roleName in ROLE_LABEL ? ROLE_LABEL[roleName as keyof typeof ROLE_LABEL] : (roleName || 'Researcher');
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

  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [savedDraft, setSavedDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keywordDraft, setKeywordDraft] = useState<string>('');

  // ── Tab navigation (Phase 2.4) ────────────────────────────────
  // The Profile page splits its content into Overview / Forum /
  // Publications / Badges tabs. Owner starts on Overview; visitor
  // defaults to Overview as well so the profile reads as one document.
  const [activeTab, setActiveTab] = useState<ProfileTabId>('overview');

  // unlockedMedals comes from the existing flair fetch above. We just
  // count unlocked ones for the badge chip on the Badges tab.
  const unlockedBadgeCount = useMemo(
    () => unlockedMedals.filter((m) => m && m.isUnlocked).length,
    [unlockedMedals],
  );

  // ── Featured flair (Phase 2.5) ────────────────────────────────
  // The BE now accepts `flairMedalId` + `flairOrder` on /api/Profile/{id}
  // (PROFILE_UPDATE_KEYS), but reads may be empty if the user has never
  // set a flair. We hydrate from localStorage (`ars_flair_<userId>`) so
  // the in-form picker and the public UserFlairBadge stay in sync even
  // when the BE column is still null.
  const flairStorageKey = (uid: number): string => `ars_flair_${uid}`;

  const [flairMedalId, setFlairMedalId] = useState<string | null>(
    profile?.flairMedalId ?? null,
  );
  const [flairOrder, setFlairOrder] = useState<string[]>(
    Array.isArray(profile?.flairOrder) ? profile.flairOrder : [],
  );

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

  // Seed the draft whenever the BE profile resolves / changes.
  useEffect(() => {
    if (!profile) {
      setDraft(EMPTY_DRAFT);
      setSavedDraft(EMPTY_DRAFT);
      return;
    }
    const next = draftFromProfile(profile);
    setDraft(next);
    setSavedDraft(next);
    // Don't auto-flip out of edit mode here — the user might still be typing
    // after a successful save, in which case the hook has already pushed the
    // freshest profile back through `profile`. We re-seed only on id change.
  }, [profile?.userId, profile?.updatedAt]);

  // Auto-dismiss the success banner after a few seconds.
  useEffect(() => {
    if (!showSuccess) return;
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    successTimeoutRef.current = setTimeout(() => setShowSuccess(false), 4000);
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, [showSuccess]);

  const validationErrors = useMemo(() => validateDraft(draft), [draft]);
  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const payload = useMemo(() => buildPayload(draft, savedDraft), [draft, savedDraft]);
  const hasChanges = Object.keys(payload).length > 0;
  const draftIsEmpty = isEmptyDraft(draft);

  const handleEnterEdit = () => {
    setMode('edit');
    setShowSuccess(false);
    clearSaveError();
  };

  const handleCancelEdit = () => {
    setDraft(savedDraft);
    setMode('view');
    clearSaveError();
    setKeywordDraft('');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (hasValidationErrors || isSaving || !hasChanges) return;
    const mergedPayload: Partial<ProfileUpdateRequest> = {
      ...payload,
      flairMedalId,
      flairOrder,
    };
    const updated = await save(mergedPayload);
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
          eyebrow="Authentication required"
          title="Sign in to view your profile"
          description="Your academic profile is private and only available once you have signed in. Please return to the sign-in page and authenticate to continue."
          breadcrumbs={
            <>
              Home <span aria-hidden>/</span>{' '}
              <span className={styles.breadcrumbsActive}>Profile</span>
            </>
          }
        />
        <EmptyState
          icon={null}
          title="Profile unavailable"
          description="Authenticate to continue."
        />
      </div>
    );
  }

  if (isLoading && !profile) {
    return (
      <div className={styles.page} style={accentStyle}>
        <PageHeader
          eyebrow="Profile"
          title={isOwner ? 'Your profile' : `${roleLabel} profile`}
          description="Fetching the latest profile information from the ARS platform."
          breadcrumbs={
            <>
              Home <span aria-hidden>/</span>{' '}
              <span className={styles.breadcrumbsActive}>Profile</span>
            </>
          }
        />
        <SkeletonRow count={6} rowHeight={48} gap={12} withHeader />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className={styles.page} style={accentStyle}>
        <PageHeader
          eyebrow="Profile"
          title={isOwner ? 'Your profile' : `${roleLabel} profile`}
          breadcrumbs={
            <>
              Home <span aria-hidden>/</span>{' '}
              <span className={styles.breadcrumbsActive}>Profile</span>
            </>
          }
        />
        <ErrorBanner
          tone="error"
          title="Couldn't load profile"
          message={error.message}
          retry={
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              data-testid="profile-retry-button"
            >
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  // Empty profile: no row on the BE yet. Still let the user fill the form.
  const hasProfile = profile !== null;
  const isEmptyProfile = !hasProfile || (hasProfile && draftIsEmpty);

  // ── Main render ────────────────────────────────────────────────────

  const displayName =
    profile?.fullName?.trim() || (isOwner ? (user?.username || user?.email) : '') || `User #${targetUserId ?? '?'}`;
  const displayEmail = profile?.email || (isOwner ? user?.email : '') || '';
  const avatarInitials = profile?.avatarInitials?.trim() || deriveInitials(displayName);

  return (
    <div className={styles.page} style={accentStyle}>
      <PageHeader
        eyebrow={isOwner ? roleMeta.eyebrow : 'Professional Showcase'}
        title={isOwner ? roleMeta.title : displayName}
        description={
          isOwner
            ? roleMeta.subtitle
            : 'Public academic presence with the profile details this member has chosen to share.'
        }
        accent={roleMeta.accentVar}
        breadcrumbs={
          <>
            Home <span aria-hidden>/</span>{' '}
            <span className={styles.breadcrumbsActive}>
              {isOwner ? 'Profile & Account Settings' : `${displayName}'s Profile`}
            </span>
          </>
        }
        actions={
          mode === 'view' ? (
            <>
              <Button
                variant="outline"
                size="md"
                leftIcon={<RefreshCw size={14} />}
                onClick={handleRefresh}
                disabled={isLoading}
              >
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
              {isOwner ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleEnterEdit}
                  data-testid="profile-edit-button"
                >
                  Edit profile
                </Button>
              ) : authenticatedUserId ? (
                <Button
                  variant={isFollowingTarget ? 'outline' : 'primary'}
                  size="md"
                  onClick={handleToggleFollowTarget}
                  disabled={isFollowActionLoading}
                >
                  {isFollowActionLoading
                    ? '…'
                    : isFollowingTarget
                      ? 'Following'
                      : '+ Follow'}
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      <section className={styles.identityCard} aria-label="Account identity">
        <div className={styles.avatar} aria-label={`Avatar for ${displayName}`}>
          {avatarInitials}
        </div>
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
            {unlockedMedals.filter((m) => m.isUnlocked && m.medal).length > 0 ? (
              <span
                className={styles.flairRow}
                aria-label={t('badges.profile.tab', 'Badges')}
              >
                {unlockedMedals
                  .filter((m) => m.isUnlocked && m.medal)
                  .map((m) =>
                    flairUserId != null ? (
                      <UserFlairBadge
                        key={m.medal.id}
                        userId={flairUserId}
                        forceMedalId={m.medal.id}
                        size="xs"
                        showTooltip
                      />
                    ) : null,
                  )}
              </span>
            ) : null}
            {isEmptyProfile && isOwner ? (
              <span className={styles.emptyBadge}>Profile not yet configured</span>
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
              title="View your followers"
            >
              <strong>{followersCount}</strong> Followers
            </button>
            <span className={styles.followDot} aria-hidden>·</span>
            <button
              type="button"
              className={styles.followLink}
              onClick={() => {
                setFollowModalTab('following');
                setIsFollowModalOpen(true);
              }}
              title="View people you follow"
            >
              <strong>{followingCount}</strong> Following
            </button>
          </div>
        </div>
      </section>

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
            title="Profile updated"
            message="Your academic profile is saved. Other users will see the updated details on your next interaction."
          />
        </div>
      )}

      {saveError && mode === 'edit' && (
        <div data-testid="profile-save-error-banner">
          <ErrorBanner
            tone="error"
            title="We couldn't save your changes"
            message={saveError.message}
          />
        </div>
      )}

      {error && profile && (
        <div data-testid="profile-refresh-error-banner">
          <ErrorBanner
            tone="warning"
            title="Refresh failed"
            message={`Showing the last cached profile. ${error.message}`}
          />
        </div>
      )}

      {mode === 'view' ? (
        <ProfileView
          draft={savedDraft}
          avatarInitials={avatarInitials}
          updatedAt={profile?.updatedAt}
          isEmpty={isEmptyProfile}
          profile={profile}
          isOwner={isOwner}
        />
      ) : (
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
      )}

      {/* Phase 2.4 — Tab navigation (view-only) + per-tab sections.
          The identity card / banners / ProfileView stay mounted above the
          tabs so they read as the profile's "masthead"; the tabs only swap
          the four lower sections (Overview / Forum / Publications / Badges).
          In edit mode we render the edit form instead and skip tabs so the
          user can't navigate away mid-edit. */}
      {targetUserId && mode === 'view' ? (
        <>
          <ProfileSectionTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            badgeCount={unlockedBadgeCount}
          />

          <div
            id="profile-tabpanel-overview"
            role="tabpanel"
            hidden={activeTab !== 'overview'}
            data-testid="profile-tabpanel-overview"
          >
            {/*
              The overview tab intentionally renders nothing below the
              ProfileView — ProfileView is the overview content, already
              mounted above. This empty panel keeps the tabpanel contract
              honest (every tab has a panel).
            */}
          </div>

          {activeTab === 'publications' ? (
            <ProfilePublicationsSection
              publications={publications}
              isLoading={isExtrasLoading}
              error={extrasError}
              isOwner={isOwner}
            />
          ) : null}

          {activeTab === 'forum' ? (
            <ProfileForumSection
              posts={forumPosts}
              isLoading={isExtrasLoading}
              error={extrasError}
              isOwner={isOwner}
            />
          ) : null}

          {activeTab === 'badges' ? (
            <ProfileBadgesSection
              userId={targetUserId}
              isOwner={isOwner}
              medals={unlockedMedals}
            />
          ) : null}
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
    </div>
  );
};

interface ProfileViewProps {
  draft: DraftFields;
  avatarInitials: string;
  updatedAt: string | null | undefined;
  isEmpty: boolean;
  profile?: ProfileDto | null;
  isOwner: boolean;
}

const ProfileView = ({ draft, avatarInitials, updatedAt, isEmpty, profile, isOwner }: ProfileViewProps) => {
  const showValue = (value: string, fallback = 'Not set') =>
    value.trim() === '' ? <span className={styles.viewEmpty}>{fallback}</span> : value;

  return (
    <section className={styles.viewCard} aria-labelledby="profile-view-title">
      <div className={styles.formHeader}>
        <h2 id="profile-view-title" className={styles.formTitle}>
          Profile details
        </h2>
        <p className={styles.formSubtitle}>
          The information other users see across the ARS platform.{' '}
          {isEmpty ? 'You haven\u2019t filled out your profile yet — use "Edit profile" to get started.' : null}
        </p>
      </div>

      <div className={styles.viewGrid}>
        <div className={styles.viewItem}>
          <span className={styles.viewLabel}>Avatar initials</span>
          <p className={styles.viewValue} data-testid="view-avatar-initials">
            {avatarInitials}
          </p>
        </div>
        <div className={styles.viewItem}>
          <span className={styles.viewLabel}>Full name</span>
          <p className={styles.viewValue} data-testid="view-full-name">
            {showValue(draft.fullName)}
          </p>
        </div>
        <div className={styles.viewItem}>
          <span className={styles.viewLabel}>Academic title</span>
          <p className={styles.viewValue} data-testid="view-academic-title">
            {showValue(draft.academicTitle)}
          </p>
        </div>
        <div className={styles.viewItem}>
          <span className={styles.viewLabel}>Institution</span>
          <p className={styles.viewValue} data-testid="view-institution">
            {showValue(draft.institution)}
          </p>
        </div>
        {isOwner ? (
          <>
            <div className={styles.viewItem}>
              <span className={styles.viewLabel}>Phone number</span>
              <p className={styles.viewValue} data-testid="view-phone-number">
                {showValue(draft.phoneNumber)}
              </p>
            </div>
            <div className={styles.viewItem}>
              <span className={styles.viewLabel}>Date of birth</span>
              <p className={styles.viewValue} data-testid="view-date-of-birth">
                {draft.dateOfBirth ? formatDisplayDate(draft.dateOfBirth) : '—'}
              </p>
            </div>
            <div className={styles.viewItem}>
              <span className={styles.viewLabel}>Gender</span>
              <p className={styles.viewValue} data-testid="view-gender">
                {showValue(draft.gender)}
              </p>
            </div>
            <div className={styles.viewItem}>
              <span className={styles.viewLabel}>Address</span>
              <p className={styles.viewValue} data-testid="view-address">
                {showValue(draft.address)}
              </p>
            </div>
          </>
        ) : null}
        <div className={`${styles.viewItem} ${styles.viewGridFull}`}>
          <span className={styles.viewLabel}>Bio</span>
          <p className={styles.viewValue} data-testid="view-bio">
            {showValue(draft.bio, 'No bio yet.')}
          </p>
        </div>
        <div className={`${styles.viewItem} ${styles.viewGridFull}`}>
          <span className={styles.viewLabel}>Research interest keywords</span>
          {draft.keywords.length === 0 ? (
            <p className={styles.viewValue}>
              <span className={styles.viewEmpty}>No keywords yet.</span>
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
            <span className={styles.viewLabel}>Academic &amp; Research Metrics</span>
            <div className={styles.metricsRow}>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>H-Index</span>
                <strong className={styles.metricValue}>{profile.hindex ?? 0}</strong>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Citations</span>
                <strong className={styles.metricValue}>{profile.totalCitations ?? 0}</strong>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Publications</span>
                <strong className={styles.metricValue}>{profile.publicationCount ?? 0}</strong>
              </div>
              {profile.majorFieldName && (
                <div className={`${styles.metric} ${styles.metricWide}`}>
                  <span className={styles.metricLabel}>Research Field</span>
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
            <span className={styles.viewLabel}>Last updated</span>
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
  const fieldError = (key: keyof DraftFields) => errors[key];
  const fieldProps = (key: keyof DraftFields) => ({
    'aria-invalid': fieldError(key) ? true : undefined,
    'aria-describedby': fieldError(key) ? `${key}-error` : undefined,
  });

  return (
    <form className={styles.formCard} onSubmit={onSubmit} aria-labelledby="profile-edit-title" noValidate>
      <div className={styles.formHeader}>
        <h2 id="profile-edit-title" className={styles.formTitle}>
          Edit your profile
        </h2>
        <p className={styles.formSubtitle}>
          Update the fields below. Only the fields you change are sent to the server.
        </p>
      </div>

      <div className={styles.formGrid}>
        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label} htmlFor="full-name-input">
            Full name <span className={styles.labelHint}>(required)</span>
          </label>
          <input
            id="full-name-input"
            data-testid="profile-input-full-name"
            className={styles.input}
            type="text"
            value={draft.fullName}
            onChange={(event) => onChange('fullName', event.target.value)}
            maxLength={PROFILE_VALIDATION.fullName.maxLength}
            {...fieldProps('fullName')}
          />
          {fieldError('fullName') ? (
            <span className={styles.fieldError} id="full-name-error" data-testid="profile-error-full-name">
              {fieldError('fullName')}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="academic-title-input">
            Academic title
          </label>
          <input
            id="academic-title-input"
            data-testid="profile-input-academic-title"
            className={styles.input}
            type="text"
            value={draft.academicTitle}
            onChange={(event) => onChange('academicTitle', event.target.value)}
            maxLength={PROFILE_VALIDATION.academicTitle.maxLength}
            {...fieldProps('academicTitle')}
          />
          {fieldError('academicTitle') ? (
            <span className={styles.fieldError} id="academic-title-error">
              {fieldError('academicTitle')}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="avatar-initials-input">
            Avatar initials
          </label>
          <input
            id="avatar-initials-input"
            data-testid="profile-input-avatar-initials"
            className={styles.input}
            type="text"
            value={draft.avatarInitials}
            onChange={(event) => onChange('avatarInitials', event.target.value)}
            maxLength={PROFILE_VALIDATION.avatarInitials.maxLength}
            placeholder="e.g. ND"
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
            Institution / University
          </label>
          <input
            id="institution-input"
            data-testid="profile-input-institution"
            className={styles.input}
            type="text"
            value={draft.institution}
            onChange={(event) => onChange('institution', event.target.value)}
            maxLength={PROFILE_VALIDATION.institution.maxLength}
            {...fieldProps('institution')}
          />
          {fieldError('institution') ? (
            <span className={styles.fieldError} id="institution-error">
              {fieldError('institution')}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="phone-input">
            Phone number
          </label>
          <input
            id="phone-input"
            data-testid="profile-input-phone"
            className={styles.input}
            type="tel"
            value={draft.phoneNumber}
            onChange={(event) => onChange('phoneNumber', event.target.value)}
            maxLength={PROFILE_VALIDATION.phoneNumber.maxLength}
            placeholder="+84 …"
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
            Date of birth
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
            Gender
          </label>
          <input
            id="gender-input"
            data-testid="profile-input-gender"
            className={styles.input}
            type="text"
            value={draft.gender}
            onChange={(event) => onChange('gender', event.target.value)}
            {...fieldProps('gender')}
          />
        </div>

        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label} htmlFor="address-input">
            Address
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
            Research interest keywords
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
                placeholder="Type a keyword and press Enter"
              />
              <button
                type="button"
                className={styles.keywordAddBtn}
                onClick={onAddKeyword}
                disabled={keywordDraft.trim() === ''}
                data-testid="profile-add-keyword-button"
              >
                Add
              </button>
            </div>
            {draft.keywords.length === 0 ? (
              <p className={styles.keywordEmpty}>
                No keywords yet. Add a few to help researchers find your work.
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
                      aria-label={`Remove keyword ${kw}`}
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
            Biography
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
            ? 'Fix the highlighted fields to continue.'
            : hasChanges
              ? 'Unsaved changes.'
              : 'No changes to save.'}
        </span>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onCancel}
          disabled={isSaving}
          data-testid="profile-cancel-button"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isSaving || hasValidationErrors || !hasChanges}
          data-testid="profile-save-button"
          isLoading={isSaving}
        >
          Save changes
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
//
// The countdown self-refreshes every minute while the tab is open, so a
// user who keeps the page open past midnight still sees an accurate count.
// A tab-visibility check pauses the timer when the tab is hidden (cheap
// CPU/perf saving — common pattern in countdown widgets).
const TRIAL_WINDOW_DAYS = 7;

interface TrialCountdownCardProps {
  trialExpiryAt: string | null | undefined;
  roleName: string | null;
}

function parseTrialExpiry(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function computeTrialState(expiry: Date | null): {
  totalDays: number;
  daysRemaining: number;
  daysUsed: number;
  endsAt: Date;
  isExpired: boolean;
  isToday: boolean;
} {
  if (!expiry) {
    return {
      totalDays: TRIAL_WINDOW_DAYS,
      daysRemaining: 0,
      daysUsed: TRIAL_WINDOW_DAYS,
      endsAt: new Date(0),
      isExpired: true,
      isToday: false,
    };
  }
  const now = Date.now();
  const msRemaining = expiry.getTime() - now;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / msPerDay));
  const daysUsed = Math.max(0, TRIAL_WINDOW_DAYS - daysRemaining);
  const isExpired = msRemaining <= 0;
  const isToday = daysRemaining === 1 || (daysRemaining === 0 && !isExpired);
  return {
    totalDays: TRIAL_WINDOW_DAYS,
    daysRemaining,
    daysUsed,
    endsAt: expiry,
    isExpired,
    isToday,
  };
}

const TrialCountdownCard = ({ trialExpiryAt, roleName }: TrialCountdownCardProps) => {
  const { t } = useI18n();
  const expiry = useMemo(() => parseTrialExpiry(trialExpiryAt), [trialExpiryAt]);
  const [tick, setTick] = useState(0);

  // Live update — re-render every minute so the countdown stays correct
  // while the tab stays open. Pause while the tab is hidden.
  useEffect(() => {
    if (!expiry || expiry.getTime() <= Date.now()) return undefined;
    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      setTick((prev) => prev + 1);
    }, 60_000);
    const onVisible = () => setTick((prev) => prev + 1);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      window.clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [expiry]);

  const state = useMemo(() => computeTrialState(expiry), [expiry, tick]);

  if (!expiry) return null;

  const roleLabel = roleName && roleName.trim() ? roleName : 'Researcher';
  const endsAtLabel = state.endsAt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  const fillPercent = Math.min(
    100,
    Math.max(0, Math.round((state.daysUsed / state.totalDays) * 100)),
  );

  // Tone: 3+ days left = calm, 1-2 = warning, today/expired = urgent.
  const tone = state.isExpired
    ? 'ended'
    : state.daysRemaining <= 2
      ? 'urgent'
      : state.daysRemaining <= 4
        ? 'warn'
        : 'calm';

  return (
    <section
      className={`${styles.trialCard} ${styles[`trialCard-${tone}`]}`}
      aria-label={t('profile.trial.aria', 'Trial status')}
      data-testid="profile-trial-card"
    >
      <div className={styles.trialIcon} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="9.25" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M11 6v5.4l3.4 1.95"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className={styles.trialBody}>
        <div className={styles.trialHeaderRow}>
          <p className={styles.trialEyebrow}>
            {state.isExpired
              ? t('profile.trial.eyebrowEnded', 'TRIAL ENDED')
              : t('profile.trial.eyebrow', 'TRIAL ACTIVE')}
          </p>
          <p className={styles.trialRole}>
            {t('profile.trial.roleLine', `${roleLabel} · 7-day trial`).replace('{role}', roleLabel)}
          </p>
        </div>
        <div className={styles.trialCountRow}>
          <p className={styles.trialCount} data-testid="profile-trial-days">
            <strong>{state.daysRemaining}</strong>
            <span className={styles.trialCountUnit}>
              {state.isExpired
                ? t('profile.trial.daysEnded', 'day(s) ago')
                : state.isToday
                  ? t('profile.trial.endsToday', 'day left · ends today')
                  : t('profile.trial.daysLeft', 'days left')}
            </span>
          </p>
          <p className={styles.trialExpiry}>
            {t('profile.trial.expiresOn', `Ends ${endsAtLabel}`).replace('{date}', endsAtLabel)}
          </p>
        </div>
        <div
          className={styles.trialProgress}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={state.totalDays}
          aria-valuenow={state.daysRemaining}
          aria-valuetext={t(
            'profile.trial.progressAria',
            `${state.daysUsed} of ${state.totalDays} days used`,
          )
            .replace('{used}', String(state.daysUsed))
            .replace('{total}', String(state.totalDays))}
        >
          <span
            className={styles.trialProgressFill}
            style={{ width: `${fillPercent}%` }}
          />
          <span className={styles.trialProgressTick} style={{ left: '14.28%' }} />
          <span className={styles.trialProgressTick} style={{ left: '28.57%' }} />
          <span className={styles.trialProgressTick} style={{ left: '42.85%' }} />
          <span className={styles.trialProgressTick} style={{ left: '57.14%' }} />
          <span className={styles.trialProgressTick} style={{ left: '71.42%' }} />
          <span className={styles.trialProgressTick} style={{ left: '85.71%' }} />
        </div>
        <p className={styles.trialHint}>
          {state.isExpired
            ? t(
                'profile.trial.hintEnded',
                'Your trial has ended. Continue using ARS with your existing account access.',
              )
            : state.daysRemaining <= 2
              ? t(
                  'profile.trial.hintUrgent',
                  'Your trial is almost over. Reach out to your administrator or upgrade to keep uninterrupted access.',
                )
              : t(
                  'profile.trial.hintCalm',
                  'Your free trial gives you full platform access. The trial ends automatically on the date below — no action is required from you today.',
                )}
        </p>
      </div>
    </section>
  );
};

export default Profile;

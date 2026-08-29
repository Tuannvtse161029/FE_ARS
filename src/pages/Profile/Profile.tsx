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

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../hooks/useProfile';
import {
  PROFILE_VALIDATION,
  resolveRoleProfileMeta,
  type Profile,
  type ProfileUpdateRequest,
} from '../../types/profile';
import { formatDate } from '../../utils/formatDate';
import { validateVietnameseName } from '../../utils/validationRules';
import { useFollowCounts } from '../../hooks/useFollowers';
import { followerService } from '../../services/follower.service';
import { FollowListModal } from '../../components/profile/FollowListModal';
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
    dateOfBirth: p.dateOfBirth ?? '',
    gender: p.gender ?? '',
    address: p.address ?? '',
  };
}

export const Profile = () => {
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
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
        <div className={styles.breadcrumbs} role="navigation">
          Home <span aria-hidden>/</span>{' '}
          <span className={styles.breadcrumbsActive}>Profile</span>
        </div>
        <div className={styles.stateBlock} role="alert">
          <span className={styles.emptyBadge}>Authentication required</span>
          <h1 className={styles.stateTitle}>Sign in to view your profile</h1>
          <p className={styles.stateBody}>
            Your academic profile is private and only available once you have signed in.
            Please return to the sign-in page and authenticate to continue.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && !profile) {
    return (
      <div className={styles.page} style={accentStyle}>
        <div className={styles.breadcrumbs} role="navigation">
          Home <span aria-hidden>/</span>{' '}
          <span className={styles.breadcrumbsActive}>Profile</span>
        </div>
        <div className={styles.stateBlock} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden />
          <h1 className={styles.stateTitle}>Loading your profile…</h1>
          <p className={styles.stateBody}>
            Fetching the latest profile information from the ARS platform.
          </p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className={styles.page} style={accentStyle}>
        <div className={styles.breadcrumbs} role="navigation">
          Home <span aria-hidden>/</span>{' '}
          <span className={styles.breadcrumbsActive}>Profile</span>
        </div>
        <div className={`${styles.stateBlock} ${styles.stateError}`} role="alert">
          <span className={styles.emptyBadge}>Couldn't load profile</span>
          <h1 className={styles.stateTitle}>We couldn't load your profile</h1>
          <p className={styles.stateBody}>{error.message}</p>
          <div className={styles.stateActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleRefresh}
              data-testid="profile-retry-button"
            >
              Retry
            </button>
          </div>
        </div>
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
      <div className={styles.breadcrumbs} role="navigation">
        Home <span aria-hidden>/</span>{' '}
        <span className={styles.breadcrumbsActive}>{isOwner ? 'Profile & Account Settings' : `${displayName}'s Profile`}</span>
      </div>

      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>{isOwner ? roleMeta.eyebrow : 'Professional Showcase'}</p>
          <h1 className={styles.title}>{isOwner ? roleMeta.title : displayName}</h1>
          <p className={styles.subtitle}>{isOwner ? roleMeta.subtitle : 'Public overview of academic publications, research expertise, and citations.'}</p>
        </div>
        <div className={styles.headerActions}>
          {mode === 'view' && (
            <>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleRefresh}
                disabled={isLoading}
                data-testid="profile-refresh-button"
              >
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
              {isOwner ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleEnterEdit}
                  data-testid="profile-edit-button"
                >
                  Edit profile
                </button>
              ) : authenticatedUserId && (
                <button
                  type="button"
                  className={isFollowingTarget ? styles.secondaryButton : styles.primaryButton}
                  onClick={handleToggleFollowTarget}
                  disabled={isFollowActionLoading}
                >
                  {isFollowActionLoading ? '…' : isFollowingTarget ? 'Following' : '+ Follow'}
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <section className={styles.identityCard} aria-label="Account identity">
        <div className={styles.avatar} aria-label={`Avatar for ${displayName}`}>
          {avatarInitials}
        </div>
        <div className={styles.identityText}>
          <h2 className={styles.identityName} data-testid="profile-display-name">
            {displayName}
          </h2>
          <p className={styles.identityRole}>
            <span className={styles.roleBadge}>{roleLabel}</span>
            {isEmptyProfile && isOwner ? (
              <span className={styles.emptyBadge}>Profile not yet configured</span>
            ) : null}
          </p>
          {displayEmail ? (
            <p className={styles.identityEmail} data-testid="profile-display-email">
              {displayEmail}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.65rem', fontSize: '0.875rem', color: '#64748b' }}>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 6px',
                margin: '-2px -6px',
                borderRadius: '4px',
                cursor: 'pointer',
                font: 'inherit',
                color: 'inherit',
                transition: 'background-color 0.15s ease',
              }}
              onClick={() => {
                setFollowModalTab('followers');
                setIsFollowModalOpen(true);
              }}
              title="View your followers"
            >
              <strong style={{ color: '#0f172a', fontWeight: 600 }}>{followersCount}</strong> Followers
            </button>
            <span>·</span>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 6px',
                margin: '-2px -6px',
                borderRadius: '4px',
                cursor: 'pointer',
                font: 'inherit',
                color: 'inherit',
                transition: 'background-color 0.15s ease',
              }}
              onClick={() => {
                setFollowModalTab('following');
                setIsFollowModalOpen(true);
              }}
              title="View people you follow"
            >
              <strong style={{ color: '#0f172a', fontWeight: 600 }}>{followingCount}</strong> Following
            </button>
          </div>
        </div>
      </section>

      {showSuccess && (
        <div
          className={`${styles.feedback} ${styles.feedbackSuccess}`}
          role="status"
          data-testid="profile-success-banner"
        >
          <div>
            <p className={styles.feedbackTitle}>Profile updated.</p>
            <p className={styles.feedbackBody}>
              Your academic profile is saved. Other users will see the updated details on
              your next interaction.
            </p>
          </div>
        </div>
      )}

      {saveError && mode === 'edit' && (
        <div
          className={`${styles.feedback} ${styles.feedbackError}`}
          role="alert"
          data-testid="profile-save-error-banner"
        >
          <div>
            <p className={styles.feedbackTitle}>We couldn't save your changes.</p>
            <p className={styles.feedbackBody}>{saveError.message}</p>
          </div>
        </div>
      )}

      {error && profile && (
        <div
          className={`${styles.feedback} ${styles.feedbackError}`}
          role="alert"
          data-testid="profile-refresh-error-banner"
        >
          <div>
            <p className={styles.feedbackTitle}>Refresh failed.</p>
            <p className={styles.feedbackBody}>
              Showing the last cached profile. {error.message}
            </p>
          </div>
        </div>
      )}

      {mode === 'view' ? (
        <ProfileView
          draft={savedDraft}
          avatarInitials={avatarInitials}
          updatedAt={profile?.updatedAt}
          isEmpty={isEmptyProfile}
          profile={profile}
        />
      ) : (
        <ProfileEditForm
          draft={draft}
          errors={validationErrors}
          isSaving={isSaving}
          hasChanges={hasChanges}
          hasValidationErrors={hasValidationErrors}
          keywordDraft={keywordDraft}
          onChange={handleFieldChange}
          onKeywordDraftChange={setKeywordDraft}
          onKeywordKeyDown={handleKeywordKeyDown}
          onAddKeyword={handleAddKeyword}
          onRemoveKeyword={handleRemoveKeyword}
          onSubmit={handleSave}
          onCancel={handleCancelEdit}
        />
      )}

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
  profile?: Profile | null;
}

const ProfileView = ({ draft, avatarInitials, updatedAt, isEmpty, profile }: ProfileViewProps) => {
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
        <div className={styles.viewItem}>
          <span className={styles.viewLabel}>Phone number</span>
          <p className={styles.viewValue} data-testid="view-phone-number">
            {showValue(draft.phoneNumber)}
          </p>
        </div>
        <div className={styles.viewItem}>
          <span className={styles.viewLabel}>Date of birth</span>
          <p className={styles.viewValue} data-testid="view-date-of-birth">
            {showValue(draft.dateOfBirth)}
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
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
              <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '120px' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>H-Index</span>
                <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>{profile.hindex ?? 0}</strong>
              </div>
              <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '120px' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Citations</span>
                <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>{profile.totalCitations ?? 0}</strong>
              </div>
              <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '120px' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Publications</span>
                <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>{profile.publicationCount ?? 0}</strong>
              </div>
              {profile.majorFieldName && (
                <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '180px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Research Field</span>
                  <strong style={{ fontSize: '1rem', color: '#0f172a', display: 'block' }}>
                    {profile.majorFieldName}
                  </strong>
                  {profile.subFieldName && (
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {profile.subFieldName}
                    </span>
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
  onChange: <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => void;
  onKeywordDraftChange: (value: string) => void;
  onKeywordKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (kw: string) => void;
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
  onChange,
  onKeywordDraftChange,
  onKeywordKeyDown,
  onAddKeyword,
  onRemoveKeyword,
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

      <div className={styles.formActions}>
        <span className={styles.formActionsHint}>
          {hasValidationErrors
            ? 'Fix the highlighted fields to continue.'
            : hasChanges
              ? 'Unsaved changes.'
              : 'No changes to save.'}
        </span>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onCancel}
          disabled={isSaving}
          data-testid="profile-cancel-button"
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={isSaving || hasValidationErrors || !hasChanges}
          data-testid="profile-save-button"
        >
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
};

export default Profile;

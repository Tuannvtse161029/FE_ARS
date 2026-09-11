import { useMemo, useState, useEffect, type CSSProperties } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useReviewerAvailability, useReviewerProfiles } from '../../hooks/useReviewerProfiles';
import { reviewerService } from '../../services/reviewer.service';
import { userService } from '../../services/user.service';
import { useMajorFields, useSubFields } from '../../hooks/useMajorFields';
import { parseEntityId } from '../../utils/entityId';
import styles from './ProfessionalProfile.module.css';

// ── Role-keyed configuration ───────────────────────────────────────────────
// The page is now reachable by three workspace roles (Researcher, Reviewer,
// Lecturer). Each role gets its own eyebrow / accent / page subtitle / which
// sections are rendered.
//
//   Reviewer    — full surface: availability + expertise + academic metrics
//   Researcher  — expertise + academic metrics (no availability: researchers
//                 aren't routed review requests)
//   Lecturer    — expertise only (no availability AND no academic metrics:
//                 lecturers aren't indexed on H-Index / citations)
//
// Adding a fourth role later means appending a single entry here, plus a
// matching CSS accent class in ProfessionalProfile.module.css.
type SupportedRoleKey = 'Researcher' | 'Reviewer' | 'Lecturer';

interface RoleSurfaceConfig {
  eyebrow: string;
  pageTitle: string;
  pageSubtitle: string;
  badgeLabel: string;
  /** Primary accent token — drives header rule + avatar + buttons. */
  accentVar: string;
  /** Mid-tone accent token — drives hover states. */
  accentMidVar: string;
  /** Light accent token — drives the role badge background. */
  accentLightVar: string;
  /** Whether to render the Availability section (Reviewer-only). */
  showAvailability: boolean;
  /** Whether to render the Academic Metrics section (Reviewer + Researcher). */
  showAcademicMetrics: boolean;
  /** Fallback avatar initial when the user's name is empty. */
  fallbackInitial: string;
  /** Copy for the Major/Sub field section heading + form. */
  expertiseHeading: string;
  expertiseSubheading: string;
  saveButtonLabel: string;
}

const ROLE_SURFACE_CONFIG: Record<SupportedRoleKey, RoleSurfaceConfig> = {
  Reviewer: {
    eyebrow: 'REVIEWER WORKSPACE',
    pageTitle: 'Professional Profile',
    pageSubtitle: 'Manage your reviewer availability and research expertise.',
    badgeLabel: 'Reviewer',
    accentVar: 'var(--ars-reviewer, #065f46)',
    accentMidVar: 'var(--ars-reviewer-mid, #047857)',
    accentLightVar: 'var(--ars-reviewer-light, #d1fae5)',
    showAvailability: true,
    showAcademicMetrics: true,
    fallbackInitial: 'R',
    expertiseHeading: 'Your research specialization',
    expertiseSubheading:
      'Select your Major Field and Subfield. This helps researchers find reviewers with matching expertise.',
    saveButtonLabel: 'Save Expertise',
  },
  Researcher: {
    eyebrow: 'RESEARCHER WORKSPACE',
    pageTitle: 'Professional Profile',
    pageSubtitle: 'Curate your research expertise so reviewers and other researchers can find you.',
    badgeLabel: 'Researcher',
    accentVar: 'var(--ars-researcher, #b45309)',
    accentMidVar: 'var(--ars-researcher-mid, #d97706)',
    accentLightVar: 'var(--ars-researcher-light, #fef3c7)',
    // Researchers aren't routed review requests — availability is Reviewer-only.
    showAvailability: false,
    // H-Index / citations / publication count still apply to researchers.
    showAcademicMetrics: true,
    fallbackInitial: 'R',
    expertiseHeading: 'Your research specialization',
    expertiseSubheading:
      'Pick a Major Field and Subfield. Other researchers and reviewers use this to surface your work to the right audience.',
    saveButtonLabel: 'Save Expertise',
  },
  Lecturer: {
    eyebrow: 'LECTURER WORKSPACE',
    pageTitle: 'Professional Profile',
    pageSubtitle: 'Surface your teaching and research field for seminars and research groups.',
    badgeLabel: 'Lecturer',
    accentVar: 'var(--ars-lecturer, #7c2d12)',
    accentMidVar: 'var(--ars-lecturer-mid, #9a3412)',
    accentLightVar: 'var(--ars-lecturer-light, #fef2f2)',
    // Lecturers don't take review requests and aren't indexed on research
    // metrics — both surfaces stay hidden.
    showAvailability: false,
    showAcademicMetrics: false,
    fallbackInitial: 'L',
    expertiseHeading: 'Your research specialization',
    expertiseSubheading:
      'Pick a Major Field and Subfield so seminar organisers and group leaders can match you with the right topics.',
    saveButtonLabel: 'Save Expertise',
  },
};

type Feedback = { type: 'success' | 'error'; message: string } | null;

const formatUpdatedAt = (value?: string): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
};

const getInitials = (value: string, fallback: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || fallback;

/**
 * Narrow an arbitrary string from the auth store / BE into one of the
 * supported role keys for this page. Unknown values fall back to
 * `Reviewer` because that role still has a valid profile surface (it's
 * the historical "default" for this page); we deliberately don't throw —
 * the route guard above already locks out unsupported roles, so anything
 * we receive here is at minimum a workspace role.
 */
function resolveRoleKey(role: string | null | undefined): SupportedRoleKey {
  if (role === 'Researcher' || role === 'Lecturer' || role === 'Reviewer') {
    return role;
  }
  return 'Reviewer';
}

export const ProfessionalProfile = () => {
  const { user } = useAuth();
  const authenticatedUserId = user?.userId;
  const roleKey = resolveRoleKey(user?.role);
  const roleConfig = ROLE_SURFACE_CONFIG[roleKey];

  const { profiles, isLoading, error, refetch } = useReviewerProfiles();
  // Availability hook is Reviewer-only, but we still need the variable to
  // satisfy the linter — the result is only consumed when
  // roleConfig.showAvailability is true.
  const { isAvailable, isLoading: isAvailabilityLoading } = useReviewerAvailability(authenticatedUserId);
  const professionalProfile = useMemo(
    () => profiles.find((profile) => profile.userId === authenticatedUserId) ?? null,
    [profiles, authenticatedUserId],
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [account, setAccount] = useState<{ fullName?: string; email?: string } | null>(null);

  // Research Expertise state
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [expertiseFeedback, setExpertiseFeedback] = useState<Feedback>(null);
  const [isSubmittingExpertise, setIsSubmittingExpertise] = useState(false);

  // Load Major Fields and Subfields
  const { fields: majorFields, isLoading: isMajorsLoading } = useMajorFields();
  // Only fetch subfields when a valid positive majorId is selected
  const { subFields, isLoading: isSubsLoading } = useSubFields(selectedMajorId);

  // Initialize expertise fields from profile
  useEffect(() => {
    if (professionalProfile) {
      setSelectedMajorId(professionalProfile.majorFieldId ?? null);
      setSelectedSubId(professionalProfile.subFieldId ?? null);
    }
  }, [professionalProfile?.userId, professionalProfile?.majorFieldId, professionalProfile?.subFieldId]);

  useEffect(() => {
    if (authenticatedUserId === undefined) return;

    let cancelled = false;
    userService.getById(authenticatedUserId).then((nextAccount) => {
      if (cancelled) return;
      setAccount(nextAccount);
    }).catch(() => {
      if (cancelled) return;
      setAccount(null);
    });
    return () => {
      cancelled = true;
    };
  }, [authenticatedUserId]);

  // Expertise validation
  const isExpertiseValid = selectedMajorId !== null && selectedSubId !== null;
  const hasExpertiseChanged =
    selectedMajorId !== (professionalProfile?.majorFieldId ?? null) ||
    selectedSubId !== (professionalProfile?.subFieldId ?? null);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await Promise.all([refetch()]);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleMajorChange = (event: import('react').ChangeEvent<HTMLSelectElement>) => {
    const newMajorId = parseEntityId(event.target.value);
    setSelectedMajorId(newMajorId);
    // Clear Subfield when Major changes to avoid invalid combinations
    setSelectedSubId(null);
    setExpertiseFeedback(null);
  };

  const handleSubChange = (event: import('react').ChangeEvent<HTMLSelectElement>) => {
    const newSubId = parseEntityId(event.target.value);
    setSelectedSubId(newSubId);
    setExpertiseFeedback(null);
  };

  const handleSaveExpertise = async (event: import('react').FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!professionalProfile || authenticatedUserId === undefined || !isExpertiseValid || !hasExpertiseChanged || isSubmittingExpertise) {
      if (!isExpertiseValid) {
        setExpertiseFeedback({ type: 'error', message: 'Please select both Major Field and Subfield.' });
      }
      return;
    }

    const previousMajor = professionalProfile.majorFieldId;
    const previousSub = professionalProfile.subFieldId;
    setIsSubmittingExpertise(true);
    setExpertiseFeedback(null);

    try {
      // Send only taxonomy IDs (minimal PATCH payload)
      await reviewerService.update(authenticatedUserId, {
        userId: authenticatedUserId,
        majorFieldId: selectedMajorId,
        subFieldId: selectedSubId
      });
      await refetch();
      setExpertiseFeedback({ type: 'success', message: 'Research expertise updated successfully.' });
    } catch (saveError) {
      // Restore previous values on error
      setSelectedMajorId(previousMajor ?? null);
      setSelectedSubId(previousSub ?? null);
      setExpertiseFeedback({
        type: 'error',
        message: saveError instanceof Error && saveError.message ? saveError.message : 'Unable to save research expertise. Previous values restored.',
      });
    } finally {
      setIsSubmittingExpertise(false);
    }
  };

  // ── Per-role CSS accent override ──────────────────────────────────────
  // Drives the inline `--profile-accent` custom property used by the
  // module CSS to tint the page-header rule, avatar, primary buttons,
  // and focus rings for non-Reviewer roles.
  const accentStyle = useMemo<CSSProperties>(
    () => ({
      ['--profile-accent' as string]: roleConfig.accentVar,
      ['--profile-accent-mid' as string]: roleConfig.accentMidVar,
      ['--profile-accent-light' as string]: roleConfig.accentLightVar,
    }),
    [roleConfig.accentVar, roleConfig.accentMidVar, roleConfig.accentLightVar],
  );

  if (isLoading) {
    return <div className={styles.state} role="status" style={accentStyle}>Loading your professional profile…</div>;
  }

  if (error) {
    return (
      <div className={styles.state} role="alert" style={accentStyle}>
        <p>We couldn’t load your professional profile.</p>
        <button className={styles.primaryButton} onClick={handleRetry} disabled={isRetrying}>
          {isRetrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!professionalProfile) {
    // Professional profile missing — provide a clear onboarding destination
    // OR an explanation when setup is unavailable in the current environment.
    return (
      <div className={styles.state} role="status" style={accentStyle}>
        <h1>Professional Profile</h1>
        <p>
          No professional profile was found for the authenticated {roleConfig.badgeLabel.toLowerCase()} account.
          A profile is required so reviewers and other researchers can find you.
        </p>
        <p className={styles.stateHint}>
          If you have just upgraded to the {roleConfig.badgeLabel} role, it may take a moment for
          the system to provision your profile. Otherwise, contact the editorial
          Admin to request onboarding, or use the action below to retry.
        </p>
        <div className={styles.stateActions}>
          <button
            className={styles.primaryButton}
            onClick={handleRetry}
            disabled={isRetrying}
            data-testid="profile-retry"
          >
            {isRetrying ? 'Retrying…' : 'Retry loading profile'}
          </button>
          {roleKey === 'Reviewer' ? (
            <a
              className={styles.secondaryButton}
              href="/onboarding/reviewer"
              data-testid="profile-onboarding-link"
            >
              Open reviewer onboarding
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  const fullName = account?.fullName || user?.username || roleConfig.badgeLabel;
  const email = account?.email || user?.email || 'Email unavailable';
  const displayAvailability =
    !roleConfig.showAvailability
      ? '—'
      : isAvailabilityLoading
        ? 'Checking…'
        : isAvailable === null
          ? 'Unavailable'
          : isAvailable
            ? 'Available'
            : 'Unavailable';

  // The <dl> rows are built conditionally so a non-Reviewer profile card
  // never advertises an "Availability" field that doesn't apply to them.
  const profileDetailRows: Array<{ label: string; value: React.ReactNode; testId?: string }> = [
    { label: 'ORCID', value: professionalProfile.orcidId ?? 'Not set' },
    { label: 'Synchronization', value: professionalProfile.syncStatus ?? 'Not available' },
    { label: 'Last updated', value: formatUpdatedAt(professionalProfile.updatedAt) },
  ];
  if (roleConfig.showAvailability) {
    profileDetailRows.push({
      label: 'Availability',
      value: (
        <span className={isAvailable ? styles.statusAvailable : styles.statusUnavailable}>
          {displayAvailability}
        </span>
      ),
    });
  }

  return (
    <div className={styles.page} style={accentStyle} data-role={roleKey}>
      <div className={styles.breadcrumbs}>Home <span>/</span> Professional Profile</div>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow} data-testid="professional-profile-eyebrow">
            {roleConfig.eyebrow}
          </p>
          <h1>{roleConfig.pageTitle}</h1>
          <p className={styles.subtitle}>{roleConfig.pageSubtitle}</p>
        </div>
        <button className={styles.secondaryButton} onClick={handleRetry} disabled={isRetrying}>
          Refresh profile
        </button>
      </header>

      <section className={styles.profileCard} aria-labelledby="profile-summary-title">
        <div className={styles.identity}>
          <div className={styles.avatar} aria-label={`${fullName} avatar`} data-testid="professional-profile-avatar">
            {getInitials(fullName, roleConfig.fallbackInitial)}
          </div>
          <div>
            <h2 id="profile-summary-title">{fullName}</h2>
            <p>{email}</p>
            <span
              className={styles.reviewerBadge}
              data-testid="professional-profile-role-badge"
            >
              {roleConfig.badgeLabel}
            </span>
          </div>
        </div>
        <dl className={styles.profileDetails}>
          {profileDetailRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.expertiseSection} data-testid="research-expertise-section" aria-labelledby="research-expertise-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>RESEARCH EXPERTISE</p>
            <h2 id="research-expertise-title">{roleConfig.expertiseHeading}</h2>
            <p>{roleConfig.expertiseSubheading}</p>
          </div>
        </div>
        <form className={styles.expertiseForm} onSubmit={handleSaveExpertise}>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label htmlFor="major-field">Major Field</label>
              <select
                id="major-field"
                data-testid="major-field-select"
                value={selectedMajorId ?? ''}
                onChange={handleMajorChange}
                disabled={isMajorsLoading}
              >
                <option value="">Select a Major Field</option>
                {majorFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formField}>
              <label htmlFor="sub-field">Subfield</label>
              <select
                id="sub-field"
                data-testid="sub-field-select"
                value={selectedSubId ?? ''}
                onChange={handleSubChange}
                disabled={selectedMajorId === null || isMajorsLoading || isSubsLoading}
              >
                <option value="">Select a Subfield</option>
                {subFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            className={styles.primaryButton}
            type="submit"
            data-testid="save-expertise-button"
            disabled={!isExpertiseValid || !hasExpertiseChanged || isSubmittingExpertise}
          >
            {isSubmittingExpertise ? 'Saving…' : roleConfig.saveButtonLabel}
          </button>
          {expertiseFeedback && (
            <div
              className={expertiseFeedback.type === 'success' ? styles.successFeedback : styles.errorFeedback}
              role={expertiseFeedback.type === 'error' ? 'alert' : 'status'}
            >
              {expertiseFeedback.message}
            </div>
          )}
        </form>
      </section>

      {roleConfig.showAcademicMetrics ? (
        <section
          className={styles.metricSection}
          data-testid="academic-metrics-section"
          aria-labelledby="academic-metrics-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>ACADEMIC METRICS</p>
              <h2 id="academic-metrics-title">Verified researcher metrics</h2>
            </div>
            <span className={styles.lockLabel}>🔒 Verified metric — managed by Admin</span>
          </div>
          <div className={styles.metricGrid}>
            <article className={styles.metricCard} data-testid="metric-hindex"><span>H-index</span><strong>{professionalProfile.hindex ?? 'Not set'}</strong></article>
            <article className={styles.metricCard} data-testid="metric-total-citations"><span>Total citations</span><strong>{professionalProfile.totalCitations ?? 'Not set'}</strong></article>
            <article className={styles.metricCard} data-testid="metric-publication-count"><span>Publication count</span><strong>{professionalProfile.publicationCount ?? 'Not set'}</strong></article>
          </div>
        </section>
      ) : null}

    </div>
  );
};

export default ProfessionalProfile;

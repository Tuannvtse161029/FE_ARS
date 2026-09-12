// ProfessionalProfileTab — body content for the "Professional" tab on the
// Profile page. Holds the Major Field / Subfield selector, reviewer
// availability toggle, and academic metrics block.
//
// This component used to live as a stand-alone page at
// /reviewer/professional-profile. After we consolidated the Professional
// Profile surface into the unified /profile page (with three tabs:
// Account / Professional / Public), the page shell, breadcrumb, role
// guard, and route were stripped away. The data fetching, role-aware
// copy, and academic metrics block below are unchanged so existing
// tests and behaviour continue to work.
//
// Owner-only: the Profile page renders this tab only when the visitor
// is the authenticated user AND their role owns a professional profile
// (Researcher / Reviewer / Lecturer). Graduate Students, Admins, and
// visitors do not see the tab.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { useReviewerAvailability, useReviewerProfiles } from '../../hooks/useReviewerProfiles';
import { reviewerService } from '../../services/reviewer.service';
import { userService } from '../../services/user.service';
import { useMajorFields, useSubFields } from '../../hooks/useMajorFields';
import { parseEntityId } from '../../utils/entityId';
import styles from './ProfessionalProfileTab.module.css';

// ── Role-keyed configuration ───────────────────────────────────────────────
// Same per-role surface as the original page. Each role gets its own
// accent / page subtitle / which sections are rendered.
//
//   Reviewer    — availability + expertise + academic metrics
//   Researcher  — expertise + academic metrics (no availability)
//   Lecturer    — expertise only (no availability AND no academic metrics)
type SupportedRoleKey = 'Researcher' | 'Reviewer' | 'Lecturer';

interface RoleSurfaceConfig {
  eyebrow: string;
  pageSubtitle: string;
  badgeLabel: string;
  accentVar: string;
  accentMidVar: string;
  accentLightVar: string;
  showAvailability: boolean;
  showAcademicMetrics: boolean;
  fallbackInitial: string;
  expertiseHeading: string;
  expertiseSubheading: string;
  saveButtonLabel: string;
}

const buildRoleSurfaceConfig = (t: (k: string, fb?: string) => string): Record<SupportedRoleKey, RoleSurfaceConfig> => ({
  Reviewer: {
    eyebrow: t('profile.professional.eyebrow.reviewer'),
    pageSubtitle: t('profile.professional.subtitle.reviewer'),
    badgeLabel: t('common.role.Reviewer'),
    accentVar: 'var(--ars-reviewer, #065f46)',
    accentMidVar: 'var(--ars-reviewer-mid, #047857)',
    accentLightVar: 'var(--ars-reviewer-light, #d1fae5)',
    showAvailability: true,
    showAcademicMetrics: true,
    fallbackInitial: 'R',
    expertiseHeading: t('profile.professional.expertise.heading'),
    expertiseSubheading: t('profile.professional.expertise.subheading.reviewer'),
    saveButtonLabel: t('profile.professional.saveExpertise'),
  },
  Researcher: {
    eyebrow: t('profile.professional.eyebrow.researcher'),
    pageSubtitle: t('profile.professional.subtitle.researcher'),
    badgeLabel: t('common.role.Researcher'),
    accentVar: 'var(--ars-researcher, #b45309)',
    accentMidVar: 'var(--ars-researcher-mid, #d97706)',
    accentLightVar: 'var(--ars-researcher-light, #fef3c7)',
    showAvailability: false,
    showAcademicMetrics: true,
    fallbackInitial: 'R',
    expertiseHeading: t('profile.professional.expertise.heading'),
    expertiseSubheading: t('profile.professional.expertise.subheading.researcher'),
    saveButtonLabel: t('profile.professional.saveExpertise'),
  },
  Lecturer: {
    eyebrow: t('profile.professional.eyebrow.lecturer'),
    pageSubtitle: t('profile.professional.subtitle.lecturer'),
    badgeLabel: t('common.role.Lecturer'),
    accentVar: 'var(--ars-lecturer, #7c2d12)',
    accentMidVar: 'var(--ars-lecturer-mid, #9a3412)',
    accentLightVar: 'var(--ars-lecturer-light, #fef2f2)',
    showAvailability: false,
    showAcademicMetrics: false,
    fallbackInitial: 'L',
    expertiseHeading: t('profile.professional.expertise.heading'),
    expertiseSubheading: t('profile.professional.expertise.subheading.lecturer'),
    saveButtonLabel: t('profile.professional.saveExpertise'),
  },
});

type Feedback = { type: 'success' | 'error'; message: string } | null;

const formatUpdatedAt = (value: string | undefined, locale: string): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString(locale);
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
 * supported role keys for this tab.
 */
function resolveRoleKey(role: string | null | undefined): SupportedRoleKey {
  if (role === 'Researcher' || role === 'Lecturer' || role === 'Reviewer') {
    return role;
  }
  return 'Reviewer';
}

export interface ProfessionalProfileTabProps {
  /** Optional override for the user id under inspection. Defaults to the
   *  authenticated user. Visitors are never routed here so this stays 1:1
   *  with the authenticated user in practice. */
  userIdOverride?: number | null;
}

export const ProfessionalProfileTab = ({
  userIdOverride,
}: ProfessionalProfileTabProps) => {
  const { user } = useAuth();
  const authenticatedUserId = userIdOverride ?? user?.userId ?? null;
  const { t, locale } = useI18n();
  const ROLE_SURFACE_CONFIG = useMemo(() => buildRoleSurfaceConfig(t), [t]);
  const roleKey = resolveRoleKey(user?.role);
  const roleConfig = ROLE_SURFACE_CONFIG[roleKey];

  const { profiles, isLoading, error, refetch } = useReviewerProfiles();
  // useReviewerAvailability takes `number | undefined` — null means
  // "no user", which the hook already handles internally.
  const { isAvailable, isLoading: isAvailabilityLoading } = useReviewerAvailability(
    authenticatedUserId ?? undefined,
  );
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
  const { subFields, isLoading: isSubsLoading } = useSubFields(selectedMajorId);

  // Initialize expertise fields from profile
  useEffect(() => {
    if (professionalProfile) {
      setSelectedMajorId(professionalProfile.majorFieldId ?? null);
      setSelectedSubId(professionalProfile.subFieldId ?? null);
    }
  }, [professionalProfile?.userId, professionalProfile?.majorFieldId, professionalProfile?.subFieldId]);

  useEffect(() => {
    if (authenticatedUserId === null || authenticatedUserId === undefined) return;

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
    if (!professionalProfile || authenticatedUserId === null || authenticatedUserId === undefined || !isExpertiseValid || !hasExpertiseChanged || isSubmittingExpertise) {
      if (!isExpertiseValid) {
        setExpertiseFeedback({ type: 'error', message: t('profile.professional.expertise.validation.required') });
      }
      return;
    }

    const previousMajor = professionalProfile.majorFieldId;
    const previousSub = professionalProfile.subFieldId;
    setIsSubmittingExpertise(true);
    setExpertiseFeedback(null);

    try {
      await reviewerService.update(authenticatedUserId, {
        userId: authenticatedUserId,
        majorFieldId: selectedMajorId,
        subFieldId: selectedSubId
      });
      await refetch();
      setExpertiseFeedback({ type: 'success', message: t('profile.professional.expertise.saved') });
    } catch (saveError) {
      setSelectedMajorId(previousMajor ?? null);
      setSelectedSubId(previousSub ?? null);
      setExpertiseFeedback({
        type: 'error',
        message: saveError instanceof Error && saveError.message ? saveError.message : t('profile.professional.expertise.saveFailed'),
      });
    } finally {
      setIsSubmittingExpertise(false);
    }
  };

  const accentStyle = useMemo<CSSProperties>(
    () => ({
      ['--profile-accent' as string]: roleConfig.accentVar,
      ['--profile-accent-mid' as string]: roleConfig.accentMidVar,
      ['--profile-accent-light' as string]: roleConfig.accentLightVar,
    }),
    [roleConfig.accentVar, roleConfig.accentMidVar, roleConfig.accentLightVar],
  );

  if (isLoading) {
    return <div className={styles.state} role="status" style={accentStyle}>{t('profile.professional.loading')}</div>;
  }

  if (error) {
    return (
      <div className={styles.state} role="alert" style={accentStyle}>
        <p>{t('profile.professional.loadError')}</p>
        <button className={styles.primaryButton} onClick={handleRetry} disabled={isRetrying}>
          {isRetrying ? t('profile.professional.retrying') : t('profile.professional.retry')}
        </button>
      </div>
    );
  }

  if (!professionalProfile) {
    return (
      <div className={styles.state} role="status" style={accentStyle}>
        <h1>{t('profile.professional.title')}</h1>
        <p>
          {t('profile.professional.empty.notFound', 'No professional profile found for {role}.', { role: roleConfig.badgeLabel.toLowerCase() })}
        </p>
        <p className={styles.stateHint}>
          {t('profile.professional.empty.hint', 'You can request access through the role request workflow above.', { role: roleConfig.badgeLabel })}
        </p>
        <div className={styles.stateActions}>
          <button
            className={styles.primaryButton}
            onClick={handleRetry}
            disabled={isRetrying}
            data-testid="profile-retry"
          >
            {isRetrying ? t('profile.professional.retrying') : t('profile.professional.empty.retryLoad')}
          </button>
          {roleKey === 'Reviewer' ? (
            <a
              className={styles.secondaryButton}
              href="/onboarding/reviewer"
              data-testid="profile-onboarding-link"
            >
              {t('profile.professional.empty.openOnboarding')}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  const fullName = account?.fullName || user?.username || roleConfig.badgeLabel;
  const email = account?.email || user?.email || t('profile.professional.emailUnavailable');
  const displayAvailability = !roleConfig.showAvailability
    ? '—'
    : isAvailabilityLoading
      ? t('profile.professional.availability.checking')
      : isAvailable === null
        ? t('profile.professional.availability.unavailable')
        : isAvailable
          ? t('profile.professional.availability.available')
          : t('profile.professional.availability.unavailable');

  const profileDetailRows: Array<{ label: string; value: React.ReactNode; testId?: string }> = [
    { label: t('profile.professional.detail.orcid'), value: professionalProfile.orcidId ?? t('common.notSet') },
    { label: t('profile.professional.detail.sync'), value: professionalProfile.syncStatus ?? t('profile.professional.detail.notAvailable') },
    { label: t('profile.professional.detail.lastUpdated'), value: formatUpdatedAt(professionalProfile.updatedAt, locale) },
  ];
  if (roleConfig.showAvailability) {
    profileDetailRows.push({
      label: t('profile.professional.detail.availability'),
      value: (
        <span className={isAvailable ? styles.statusAvailable : styles.statusUnavailable}>
          {displayAvailability}
        </span>
      ),
    });
  }

  return (
    <div className={styles.tabBody} style={accentStyle} data-role={roleKey}>
      <section className={styles.profileCard} aria-labelledby="professional-profile-summary-title">
        <div className={styles.identity}>
          <div className={styles.avatar} aria-label={`${fullName} avatar`} data-testid="professional-profile-avatar">
            {getInitials(fullName, roleConfig.fallbackInitial)}
          </div>
          <div>
            <h2 id="professional-profile-summary-title">{fullName}</h2>
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
            <p className={styles.eyebrow}>{t('profile.professional.expertise.eyebrow')}</p>
            <h2 id="research-expertise-title">{roleConfig.expertiseHeading}</h2>
            <p>{roleConfig.expertiseSubheading}</p>
          </div>
        </div>
        <form className={styles.expertiseForm} onSubmit={handleSaveExpertise}>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label htmlFor="major-field">{t('profile.professional.expertise.majorField')}</label>
              <select
                id="major-field"
                data-testid="major-field-select"
                value={selectedMajorId ?? ''}
                onChange={handleMajorChange}
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
            <div className={styles.formField}>
              <label htmlFor="sub-field">{t('profile.professional.expertise.subfield')}</label>
              <select
                id="sub-field"
                data-testid="sub-field-select"
                value={selectedSubId ?? ''}
                onChange={handleSubChange}
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
            className={styles.primaryButton}
            type="submit"
            data-testid="save-expertise-button"
            disabled={!isExpertiseValid || !hasExpertiseChanged || isSubmittingExpertise}
          >
            {isSubmittingExpertise ? t('profile.professional.expertise.saving') : roleConfig.saveButtonLabel}
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
              <p className={styles.eyebrow}>{t('profile.professional.metrics.eyebrow')}</p>
              <h2 id="academic-metrics-title">{t('profile.professional.metrics.title')}</h2>
            </div>
            <span className={styles.lockLabel}>{t('profile.professional.metrics.lockLabel')}</span>
          </div>
          <div className={styles.metricGrid}>
            <article className={styles.metricCard} data-testid="metric-hindex"><span>{t('profile.professional.metrics.hindex')}</span><strong>{professionalProfile.hindex ?? t('common.notSet')}</strong></article>
            <article className={styles.metricCard} data-testid="metric-total-citations"><span>{t('profile.professional.metrics.totalCitations')}</span><strong>{professionalProfile.totalCitations ?? t('common.notSet')}</strong></article>
            <article className={styles.metricCard} data-testid="metric-publication-count"><span>{t('profile.professional.metrics.publicationCount')}</span><strong>{professionalProfile.publicationCount ?? t('common.notSet')}</strong></article>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default ProfessionalProfileTab;

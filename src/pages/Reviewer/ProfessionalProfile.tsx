import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useReviewerAvailability, useReviewerProfiles } from '../../hooks/useReviewerProfiles';
import { reviewerService } from '../../services/reviewer.service';
import { userService } from '../../services/user.service';
import { useMajorFields, useSubFields } from '../../hooks/useMajorFields';
import { parseEntityId } from '../../utils/entityId';
import styles from './ProfessionalProfile.module.css';

type Feedback = { type: 'success' | 'error'; message: string } | null;

const formatUpdatedAt = (value?: string): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
};

const getInitials = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'R';

export const ProfessionalProfile = () => {
  const { user } = useAuth();
  const authenticatedUserId = user?.userId;
  const { profiles, isLoading, error, refetch } = useReviewerProfiles();
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

  if (isLoading) {
    return <div className={styles.state} role="status">Loading your professional profile…</div>;
  }

  if (error) {
    return (
      <div className={styles.state} role="alert">
        <p>We couldn’t load your professional profile.</p>
        <button className={styles.primaryButton} onClick={handleRetry} disabled={isRetrying}>
          {isRetrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!professionalProfile) {
    return (
      <div className={styles.state} role="status">
        <h1>Professional Profile</h1>
        <p>No professional profile was found for the authenticated reviewer account.</p>
        <button className={styles.primaryButton} onClick={handleRetry} disabled={isRetrying}>
          {isRetrying ? 'Retrying…' : 'Refresh'}
        </button>
      </div>
    );
  }

  const fullName = account?.fullName || user?.username || 'Reviewer';
  const email = account?.email || user?.email || 'Email unavailable';
  const displayAvailability = isAvailabilityLoading ? 'Checking…' : isAvailable === null ? 'Unavailable' : isAvailable ? 'Available' : 'Unavailable';

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>Home <span>/</span> Professional Profile</div>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>REVIEWER WORKSPACE</p>
          <h1>Professional Profile</h1>
          <p className={styles.subtitle}>Manage your reviewer availability and research expertise.</p>
        </div>
        <button className={styles.secondaryButton} onClick={handleRetry} disabled={isRetrying}>
          Refresh profile
        </button>
      </header>

      <section className={styles.profileCard} aria-labelledby="profile-summary-title">
        <div className={styles.identity}>
          <div className={styles.avatar} aria-label={`${fullName} avatar`}>{getInitials(fullName)}</div>
          <div>
            <h2 id="profile-summary-title">{fullName}</h2>
            <p>{email}</p>
            <span className={styles.reviewerBadge}>Reviewer</span>
          </div>
        </div>
        <dl className={styles.profileDetails}>
          <div><dt>ORCID</dt><dd>{professionalProfile.orcidId ?? 'Not set'}</dd></div>
          <div><dt>Synchronization</dt><dd>{professionalProfile.syncStatus ?? 'Not available'}</dd></div>
          <div><dt>Last updated</dt><dd>{formatUpdatedAt(professionalProfile.updatedAt)}</dd></div>
          <div><dt>Availability</dt><dd><span className={isAvailable ? styles.statusAvailable : styles.statusUnavailable}>{displayAvailability}</span></dd></div>
        </dl>
      </section>

      <section className={styles.expertiseSection} data-testid="research-expertise-section" aria-labelledby="research-expertise-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>RESEARCH EXPERTISE</p>
            <h2 id="research-expertise-title">Your research specialization</h2>
            <p>Select your Major Field and Subfield. This helps researchers find reviewers with matching expertise.</p>
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
            {isSubmittingExpertise ? 'Saving…' : 'Save Expertise'}
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

      <section className={styles.metricSection} data-testid="academic-metrics-section" aria-labelledby="academic-metrics-title">
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

    </div>
  );
};

export default ProfessionalProfile;

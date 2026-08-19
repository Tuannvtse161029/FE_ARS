import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useReviewerAvailability, useReviewerProfiles } from '../../hooks/useReviewerProfiles';
import { fieldService } from '../../services/field.service';
import { reviewerService } from '../../services/reviewer.service';
import { userService } from '../../services/user.service';
import styles from './ProfessionalProfile.module.css';

const REVIEW_FEE_MIN = 0;
const REVIEW_FEE_MAX = Number.MAX_SAFE_INTEGER;

type Feedback = { type: 'success' | 'error'; message: string } | null;

const formatUpdatedAt = (value?: string): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
};

const formatVnd = (value: number | null): string => {
  if (value === null) return 'Not set';
  return `${new Intl.NumberFormat('en-US').format(value)} VND`;
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
  const [fee, setFee] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [account, setAccount] = useState<{ fullName?: string; email?: string } | null>(null);
  const [majorFieldName, setMajorFieldName] = useState<string | null>(null);
  const [subFieldName, setSubFieldName] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);

  useEffect(() => {
    setFee(professionalProfile?.reviewFee === null || professionalProfile?.reviewFee === undefined ? '' : String(professionalProfile.reviewFee));
    setFeedback(null);
  }, [professionalProfile?.userId, professionalProfile?.reviewFee]);

  useEffect(() => {
    if (authenticatedUserId === undefined) {
      setFee('');
      return;
    }

    let cancelled = false;
    setIsEnriching(true);
    void Promise.all([
      userService.getById(authenticatedUserId).catch(() => null),
      fieldService.getAllMajor().catch(() => []),
      fieldService.getAllSub().catch(() => []),
    ]).then(([nextAccount, majors, subFields]) => {
      if (cancelled) return;
      setAccount(nextAccount);
      const subField = subFields.find((field) => field.id === professionalProfile?.subFieldId);
      setSubFieldName(subField?.name ?? null);
      setMajorFieldName(subField ? majors.find((field) => field.id === subField.majorFieldId)?.name ?? null : null);
      setIsEnriching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authenticatedUserId, professionalProfile?.subFieldId]);

  const parsedFee = fee.trim() === '' ? null : Number(fee);
  const isFeeValid =
    parsedFee !== null &&
    Number.isSafeInteger(parsedFee) &&
    parsedFee >= REVIEW_FEE_MIN &&
    parsedFee <= REVIEW_FEE_MAX;
  const hasFeeChanged = parsedFee !== (professionalProfile?.reviewFee ?? null);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await Promise.all([refetch()]);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSaveFee = async (event: import('react').FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!professionalProfile || authenticatedUserId === undefined || !isFeeValid || !hasFeeChanged || isSubmitting) {
      if (!isFeeValid) setFeedback({ type: 'error', message: 'Enter a whole-number VND amount from 0 upward.' });
      return;
    }

    const previousFee = professionalProfile.reviewFee;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await reviewerService.update(authenticatedUserId, { reviewFee: parsedFee });
      await refetch();
      setFeedback({ type: 'success', message: 'Review fee updated. Future review requests will use the new fee.' });
    } catch (saveError) {
      setFee(previousFee === null ? '' : String(previousFee));
      setFeedback({
        type: 'error',
        message: saveError instanceof Error && saveError.message ? saveError.message : 'Unable to save the review fee. The server value was restored.',
      });
    } finally {
      setIsSubmitting(false);
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
          <p className={styles.subtitle}>Manage your reviewer availability and future review fee.</p>
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
          <div><dt>Major field</dt><dd>{majorFieldName ?? (isEnriching ? 'Loading…' : 'Not available')}</dd></div>
          <div><dt>Subfield</dt><dd>{subFieldName ?? (professionalProfile.subFieldId === null || professionalProfile.subFieldId === undefined ? 'Not set' : `Subfield #${professionalProfile.subFieldId}`)}</dd></div>
          <div><dt>Synchronization</dt><dd>{professionalProfile.syncStatus ?? 'Not available'}</dd></div>
          <div><dt>Last updated</dt><dd>{formatUpdatedAt(professionalProfile.updatedAt)}</dd></div>
          <div><dt>Availability</dt><dd><span className={isAvailable ? styles.statusAvailable : styles.statusUnavailable}>{displayAvailability}</span></dd></div>
        </dl>
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

      <section className={styles.feeCard} data-testid="review-fee-section" aria-labelledby="review-fee-title">
        <div>
          <p className={styles.eyebrow}>FUTURE REVIEW REQUESTS</p>
          <h2 id="review-fee-title">Review Fee</h2>
          <p>Set a whole-number VND fee. This does not change fees already locked into pending, active, or completed requests.</p>
        </div>
        <form className={styles.feeForm} onSubmit={handleSaveFee}>
          <label htmlFor="review-fee">Review fee (VND)</label>
          <div className={styles.feeControls}>
            <input
              id="review-fee"
              data-testid="review-fee-input"
              inputMode="numeric"
              pattern="[0-9]*"
              value={fee}
              onChange={(event) => setFee(event.target.value.replace(/[^0-9]/g, ''))}
              placeholder={professionalProfile.reviewFee === null ? 'Not set' : String(professionalProfile.reviewFee)}
              aria-describedby="review-fee-help"
            />
            <span>VND</span>
            <button className={styles.primaryButton} type="submit" disabled={!isFeeValid || !hasFeeChanged || isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save review fee'}
            </button>
          </div>
          <small id="review-fee-help">Only whole-number VND values are accepted. Current server value: {formatVnd(professionalProfile.reviewFee)}.</small>
          {feedback && <div className={feedback.type === 'success' ? styles.successFeedback : styles.errorFeedback} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</div>}
        </form>
      </section>
    </div>
  );
};

export default ProfessionalProfile;

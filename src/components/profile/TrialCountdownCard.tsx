import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import styles from './TrialCountdownCard.module.css';

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

export { TrialCountdownCard };

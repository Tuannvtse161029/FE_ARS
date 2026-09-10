/**
 * SubscriptionBadge — compact status badge shown in the header profile
 * dropdown (and any other surface that calls it).
 *
 * Renders one of three states:
 *   - "Researcher Yearly · expires Sep 10, 2027" (active subscription)
 *   - "Inactive subscription" (expired or missing for paid roles)
 *   - "Premium not required" (non-paid roles)
 *
 * The badge refreshes:
 *   - On mount
 *   - Every 5 minutes while mounted
 *   - On window focus
 *
 * This is a UI-only component. It reads from the shared `useSubscription`
 * hook so the header and the Subscription page never disagree.
 */
import { useEffect } from 'react';
import { Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import { useLocale } from '../../i18n/I18nContext';
import styles from './SubscriptionBadge.module.css';

const formatDate = (
  iso: string | undefined | null,
  locale: 'vi' | 'en' = 'en',
): string => {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const tag = locale === 'vi' ? 'vi-VN' : 'en-US';
  return new Date(ts).toLocaleDateString(tag, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const SubscriptionBadge = () => {
  const locale = useLocale();
  const { current, isApplicable, isLoading, refetch, error } = useSubscription();

  // Periodic refetch + window focus refresh
  useEffect(() => {
    if (!isApplicable) return undefined;
    const onFocus = () => {
      void refetch();
    };
    window.addEventListener('focus', onFocus);
    const intervalId = window.setInterval(() => {
      void refetch();
    }, REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
    };
  }, [isApplicable, refetch]);

  // Not applicable for the current role
  if (!isApplicable) {
    return (
      <div className={styles.badge} data-testid="subscription-badge-na">
        <span className={styles.label}>Subscription</span>
        <span className={styles.valueMuted}>Not required</span>
      </div>
    );
  }

  if (isLoading && !current) {
    return (
      <div className={styles.badge} data-testid="subscription-badge-loading">
        <span className={styles.label}>Subscription</span>
        <span className={styles.valueMuted}>Loading…</span>
      </div>
    );
  }

  if (error && !current) {
    return (
      <div className={styles.badge} data-testid="subscription-badge-error">
        <span className={styles.label}>Subscription</span>
        <span className={styles.valueMuted}>
          <AlertTriangle size={12} aria-hidden /> Unavailable
        </span>
      </div>
    );
  }

  if (!current) {
    return (
      <div className={styles.badge} data-testid="subscription-badge-missing">
        <span className={styles.label}>Subscription</span>
        <span className={styles.valueMuted}>
          <AlertTriangle size={12} aria-hidden /> No active subscription
        </span>
      </div>
    );
  }

  // Primary source: expiresAt from UserSubscriptions (the BE's new canonical
  // expiry field). Fall back to purchase.expiryDate for backward compatibility.
  const planName = current.annualFee?.name ?? (current.daysRemaining > 0 ? `${current.daysRemaining}d Subscription` : 'Annual Fee');
  const expiresOn = current.expiresAt ?? current.purchase?.expiryDate ?? (current.daysRemaining > 0 ? new Date(Date.now() + current.daysRemaining * 86400000).toISOString() : null);
  const expired = current.isExpired;
  const daysLeft = current.daysRemaining;

  return (
    <div
      className={`${styles.badge} ${expired ? styles.badgeExpired : styles.badgeActive}`}
      data-testid="subscription-badge-active"
    >
      <span className={styles.label}>Subscription</span>
      <span className={styles.value}>
        {expired ? (
          <AlertTriangle size={12} aria-hidden />
        ) : (
          <CheckCircle2 size={12} aria-hidden />
        )}
        <strong>{planName}</strong>
      </span>
      <span className={styles.meta}>
        <Calendar size={11} aria-hidden />
        {expired
          ? `Expired ${formatDate(expiresOn, locale)}`
          : `${daysLeft}d left · expires ${formatDate(expiresOn, locale)}`}
      </span>
    </div>
  );
};

export default SubscriptionBadge;

/**
 * Subscription — Researcher / Lecturer paid-access page.
 *
 * Renders the user's current subscription status and the available
 * plans (6 months / 12 months) sourced from the BE. The page calls
 * `POST /api/Subscription/order` exactly once when the user clicks
 * `Proceed to Pay`, then redirects the browser to the returned PayOS
 * checkout URL.
 *
 * TEMPORARY DISABLED STATE: when `AppConfig.features.enableSubscriptionAccess`
 * is `false`, the page shows a "feature disabled" banner and does not
 * render plan selection or the PayOS `Proceed to Pay` button. Researcher
 * and Lecturer access is unlocked at the `useSubscription` hook level.
 * See `src/config/app.ts` and `docs/BACKEND_ANNUAL_SUBSCRIPTION_API_TICKET.md`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';
import { subscriptionService } from '../../services/subscription.service';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRow } from '../../components/SkeletonRow';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SubscriptionBackendUnavailableError } from '../../types/subscription';
import type {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../types/subscription';
import { ROUTES } from '../../routes/paths';
import { AppConfig } from '../../config/app';
import styles from './Subscription.module.css';

const formatVnd = (value: number): string =>
  new Intl.NumberFormat('vi-VN').format(value);

const formatDate = (iso: string | undefined | null): string => {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  PENDING_PAYMENT: 'Pending payment',
  CANCELLED: 'Cancelled',
};

const STATUS_CLASS: Record<SubscriptionStatus, string> = {
  ACTIVE: styles.statusTagActive ?? '',
  EXPIRED: styles.statusTagExpired ?? '',
  PENDING_PAYMENT: styles.statusTagPending ?? '',
  CANCELLED: styles.statusTagExpired ?? '',
};

const FEATURE_LINES: Record<number, string[]> = {
  6: [
    'Full Researcher / Lecturer workspace access for 6 months',
    'Forum read + interact',
    'Submit, edit, and manage your materials and submissions',
  ],
  12: [
    'Full Researcher / Lecturer workspace access for 12 months',
    'Forum read + interact',
    'Submit, edit, and manage your materials and submissions',
    'Save vs the 6-month plan',
  ],
};

export const Subscription = () => {
  const { user } = useAuth();
  const location = useLocation();
  const {
    current,
    isLoading: isSubscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription,
  } = useSubscription();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<Error | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderError, setOrderError] = useState<Error | null>(null);

  const userFullName = user?.username || user?.email || 'Account';

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const list = await subscriptionService.listPlans();
      const active = (list ?? []).filter((plan) => plan.isActive);
      const sorted = [...active].sort(
        (a, b) => a.durationMonths - b.durationMonths,
      );
      setPlans(sorted);
      if (sorted.length > 0) {
        setSelectedPlanId((prev) =>
          prev != null && sorted.some((p) => p.id === prev)
            ? prev
            : sorted[0].id,
        );
      } else {
        setSelectedPlanId(null);
      }
    } catch (caught) {
      if (caught instanceof SubscriptionBackendUnavailableError) {
        setPlansError(caught);
      } else {
        const wrapped =
          caught instanceof Error
            ? caught
            : new Error('Failed to load subscription plans.');
        setPlansError(wrapped);
      }
      setPlans([]);
      setSelectedPlanId(null);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  // When the user lands here after PayOS returns, force a fresh fetch of
  // both plans and current subscription so the page reflects the BE's
  // authoritative state.
  useEffect(() => {
    if (location.pathname === ROUTES.SUBSCRIPTION) {
      void refetchSubscription();
    }
  }, [location.pathname, refetchSubscription]);

  const selectedPlan = useMemo<SubscriptionPlan | null>(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const handleProceedToPay = useCallback(async () => {
    if (!selectedPlan) return;
    setIsOrdering(true);
    setOrderError(null);
    try {
      const order = await subscriptionService.createOrder({
        planId: selectedPlan.id,
        returnUrl:
          typeof window !== 'undefined'
            ? `${window.location.origin}${ROUTES.SUBSCRIPTION_RETURN}`
            : null,
        cancelUrl:
          typeof window !== 'undefined'
            ? `${window.location.origin}${ROUTES.SUBSCRIPTION}`
            : null,
      });
      if (order.checkoutUrl && typeof order.checkoutUrl === 'string') {
        // Browser-side redirect only. The FE never grants access from the
        // returned query string — the BE confirms payment via webhook.
        window.location.assign(order.checkoutUrl);
        return;
      }
      throw new Error('Backend did not return a PayOS checkout URL.');
    } catch (caught) {
      if (caught instanceof SubscriptionBackendUnavailableError) {
        setOrderError(caught);
      } else if (caught instanceof Error) {
        setOrderError(caught);
      } else {
        setOrderError(new Error('Failed to start subscription payment.'));
      }
    } finally {
      setIsOrdering(false);
    }
  }, [selectedPlan]);

  const awaitingApi =
    subscriptionError instanceof SubscriptionBackendUnavailableError ||
    plansError instanceof SubscriptionBackendUnavailableError;

  // Feature is temporarily disabled. Researcher / Lecturer retain full access.
  // The page is kept to avoid breaking the /subscription route; no payment
  // UI is rendered until the BE contract is published and the flag is
  // enabled.
  const featureDisabled = !AppConfig.features.enableSubscriptionAccess;

  return (
    <div className={styles.page} data-component="SubscriptionPage">
      <PageHeader
        eyebrow="ARS subscription"
        title="Researcher / Lecturer access"
        description={`Signed in as ${userFullName}. Renew your subscription to keep full Researcher and Lecturer features.`}
      />

      {featureDisabled && (
        <div
          className={styles.banner}
          role="status"
          aria-live="polite"
          data-testid="subscription-feature-disabled"
        >
          Annual subscription is temporarily unavailable. Researcher and
          Lecturer features are fully accessible. Subscription payment
          integration will resume once the backend APIs are ready.
        </div>
      )}

      {subscriptionError && !awaitingApi && (
        <ErrorBanner
          message={subscriptionError.message}
          retry={(
            <button type="button" onClick={() => void refetchSubscription()}>
              Retry
            </button>
          )}
        />
      )}

      <section
        className={styles.statusCard}
        aria-labelledby="subscription-current-status"
      >
        <div className={styles.headerBlock}>
          <span className={styles.eyebrow}>Current subscription</span>
          <h2 id="subscription-current-status" className={styles.title}>
            {isSubscriptionLoading
              ? 'Loading subscription…'
              : current
                ? STATUS_LABEL[current.status]
                : 'No active subscription'}
          </h2>
        </div>
        {current && (
          <div className={styles.statusRow}>
            <span
              className={`${styles.statusTag} ${STATUS_CLASS[current.status] ?? ''}`}
            >
              {current.status}
            </span>
            <span className={styles.statusMeta}>
              Started {formatDate(current.startsAt)} · Expires{' '}
              {formatDate(current.expiresAt)}
            </span>
          </div>
        )}
      </section>

      {!featureDisabled && (
        <section aria-labelledby="subscription-plans-title">
          <div className={styles.headerBlock}>
            <span className={styles.eyebrow}>Choose a plan</span>
            <h2 id="subscription-plans-title" className={styles.title}>
              Subscription plans
            </h2>
            <p className={styles.description}>
              Prices are configured by the platform. The values below are
              sourced from the backend; we never hardcode a VND amount on
              this page.
            </p>
          </div>

          {plansLoading ? (
            <div data-testid="plans-loading" style={{ display: 'grid', gap: 12 }}>
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : plansError && !awaitingApi ? (
            <ErrorBanner
              message={plansError.message}
              retry={(
                <button type="button" onClick={() => void fetchPlans()}>
                  Retry
                </button>
              )}
            />
          ) : plans.length === 0 ? (
            <div className={styles.empty}>
              No subscription plans are available right now.
            </div>
          ) : (
            <div className={styles.plansGrid}>
              {plans.map((plan) => {
                const selected = plan.id === selectedPlanId;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    className={`${styles.planCard} ${selected ? styles.planCardSelected : ''}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                    aria-pressed={selected}
                    data-testid={`plan-card-${plan.durationMonths}`}
                    data-plan-id={plan.id}
                    data-price-vnd={plan.priceVnd}
                  >
                    <span className={styles.planDuration}>
                      {plan.durationMonths} months
                    </span>
                    <span className={styles.planPrice}>
                      {formatVnd(plan.priceVnd)}{' '}
                      <span className={styles.planPriceCurrency}>
                        {plan.currency}
                      </span>
                    </span>
                    <ul className={styles.planFeatures}>
                      {(FEATURE_LINES[plan.durationMonths] ?? [
                        'Full Researcher / Lecturer workspace access',
                      ]).map((line) => (
                        <li key={line} className={styles.planFeature}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!featureDisabled && (
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.proceedButton}
            onClick={() => void handleProceedToPay()}
            disabled={
              !selectedPlan ||
              isOrdering ||
              plansLoading ||
              plansError !== null
            }
            data-testid="proceed-to-pay"
          >
            {isOrdering ? 'Starting PayOS checkout…' : 'Proceed to Pay'}
          </button>
        </div>
      )}

      {orderError && (
        <div className={styles.errorBox} role="alert">
          {orderError.message}
        </div>
      )}
    </div>
  );
};

export default Subscription;

/**
 * Subscription — Researcher / Lecturer paid-access page.
 *
 * Wires the live BE AnnualFees + PayOS flow (BE-ANNUAL-FEE-01). The page
 * renders:
 *
 *   - Current subscription card (or "No active subscription" placeholder)
 *   - Plan catalogue sourced from `GET /api/AnnualFees/active` filtered
 *     by the user's role
 *   - "Pay with PayOS" button per plan that calls
 *     `POST /api/AnnualFees/{id}/purchase` and redirects to the returned
 *     `checkoutUrl`
 *   - Purchase history table from `GET /api/AnnualFees/my-purchases`
 *
 * No mock plans. No fabricated VND amounts. All prices come from the BE.
 *
 * When the user lands here after PayOS returns, the page re-fetches
 * the current subscription so the card reflects the BE's authoritative
 * state.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Loader,
  XCircle,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';
import { useLocale } from '../../i18n/I18nContext';
import { annualFeeService } from '../../services/annualFee.service';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRow } from '../../components/SkeletonRow';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Button } from '../../components/Button/Button';
import { ROUTES } from '../../routes/paths';
import { AppConfig } from '../../config/app';
import type {
  AnnualFee,
  AnnualFeeBillingCycle,
  AnnualFeePurchase,
  AnnualFeePurchaseStatus,
} from '../../types/annualFee';
import styles from './Subscription.module.css';

const formatVnd = (value: number | undefined | null): string => {
  if (typeof value !== 'number') return '—';
  return new Intl.NumberFormat('vi-VN').format(value);
};

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

const formatDateTime = (
  iso: string | undefined | null,
  locale: 'vi' | 'en' = 'en',
): string => {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const tag = locale === 'vi' ? 'vi-VN' : 'en-US';
  return new Date(ts).toLocaleString(tag, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const STATUS_LABEL: Record<AnnualFeePurchaseStatus, string> = {
  Pending: 'Pending payment',
  Paid: 'Paid',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
};

const STATUS_ICON: Record<AnnualFeePurchaseStatus, React.ReactNode> = {
  Pending: <Clock size={14} aria-hidden />,
  Paid: <CheckCircle2 size={14} aria-hidden />,
  Failed: <XCircle size={14} aria-hidden />,
  Cancelled: <XCircle size={14} aria-hidden />,
};

const billingCycleMonths = (cycle: AnnualFeeBillingCycle): number => {
  switch (cycle) {
    case 'SixMonth':
      return 6;
    case 'Annual':
      return 12;
    default:
      return 12;
  }
};

const billingCycleLabel = (
  cycle: AnnualFeeBillingCycle | string | null | undefined,
): string => {
  if (!cycle) return '—';
  const months = billingCycleMonths(cycle as AnnualFeeBillingCycle);
  if (cycle === 'Annual') return `${months} months (Yearly)`;
  if (cycle === 'SixMonth') return `${months} months`;
  return cycle;
};

export const Subscription = () => {
  const { user } = useAuth();
  const location = useLocation();
  const locale = useLocale();
  const {
    current,
    isLoading: isSubscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription,
  } = useSubscription();

  const [plans, setPlans] = useState<AnnualFee[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<Error | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderError, setOrderError] = useState<Error | null>(null);

  const [history, setHistory] = useState<AnnualFeePurchase[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const userFullName = user?.username || user?.email || 'Account';

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const result = await annualFeeService.listActiveAnnualFeePlans({
        page: 1,
        pageSize: 20,
      });
      const list = result.items ?? [];
      setPlans(list);
      if (list.length > 0) {
        setSelectedPlanId((prev) =>
          prev != null && list.some((p) => p.id === prev)
            ? prev
            : list[0].id,
        );
      } else {
        setSelectedPlanId(null);
      }
    } catch (caught) {
      const wrapped =
        caught instanceof Error
          ? caught
          : new Error('Failed to load subscription plans.');
      setPlansError(wrapped);
      setPlans([]);
      setSelectedPlanId(null);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await annualFeeService.getMyPurchaseHistory({
        page: 1,
        pageSize: 10,
      });
      setHistory(result.items ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlans();
    void fetchHistory();
  }, [fetchPlans, fetchHistory]);

  // When the user lands here after PayOS returns, force a fresh fetch of
  // both plans and current subscription so the page reflects the BE's
  // authoritative state.
  useEffect(() => {
    if (location.pathname === ROUTES.SUBSCRIPTION) {
      void refetchSubscription();
      void fetchHistory();
    }
  }, [location.pathname, refetchSubscription, fetchHistory]);

  const selectedPlan = useMemo<AnnualFee | null>(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const handleProceedToPay = useCallback(async () => {
    if (!selectedPlan) return;
    setIsOrdering(true);
    setOrderError(null);
    try {
      const order = await annualFeeService.purchaseAnnualFee(selectedPlan.id, {
        returnUrl:
          typeof window !== 'undefined'
            ? `${window.location.origin}${ROUTES.SUBSCRIPTION_RETURN}?status=success`
            : null,
        cancelUrl:
          typeof window !== 'undefined'
            ? `${window.location.origin}${ROUTES.SUBSCRIPTION_RETURN}?status=cancelled`
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
      setOrderError(
        caught instanceof Error ? caught : new Error('Failed to start subscription payment.'),
      );
    } finally {
      setIsOrdering(false);
    }
  }, [selectedPlan]);

  const featureDisabled = !AppConfig.features.enableSubscriptionAccess;
  // True when the BE has returned a valid subscription that is not expired.
  // These users should see their active status — not plan selection or a pay
  // button — so they are never asked to re-subscribe.
  const hasActiveSubscription = !featureDisabled && current != null && !current.isExpired;

  return (
    <div className={styles.page} data-component="SubscriptionPage">
      <PageHeader
        eyebrow="ARS subscription"
        title="Researcher / Lecturer access"
        description={
          hasActiveSubscription
            ? `Signed in as ${userFullName}. Your subscription is active — all features are unlocked.`
            : `Signed in as ${userFullName}. Subscribe to unlock full Researcher and Lecturer features.`
        }
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

      {subscriptionError && (
        <ErrorBanner
          message={subscriptionError.message}
          retry={
            <button type="button" onClick={() => void refetchSubscription()}>
              Retry
            </button>
          }
        />
      )}

      {/* ACTIVE CONFIRMATION BANNER */}
      {hasActiveSubscription && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3, 12px)',
            padding: 'var(--space-4, 16px)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md, 8px)',
            color: '#065f46',
            marginBottom: 'var(--space-6, 24px)',
          }}
          role="status"
          data-testid="subscription-active-banner"
        >
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} aria-hidden />
          <div>
            <strong>Subscription active.</strong> All workspace features (Seminar, Research Topics, Research Groups, Phase Reports, Materials, and Research Papers) are fully accessible.
          </div>
        </div>
      )}

      {/* CURRENT SUBSCRIPTION */}
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
                ? current.annualFee?.name ?? (current.daysRemaining > 0 ? `${current.daysRemaining}-Day Subscription` : 'Active subscription')
                : 'No active subscription'}
          </h2>
        </div>
        {current && (
          <>
            <div className={styles.statusRow}>
              <span
                className={`${styles.statusTag} ${
                  current.isExpired ? styles.statusTagExpired : styles.statusTagActive
                }`}
              >
                {current.isExpired ? 'EXPIRED' : 'ACTIVE'}
              </span>
              <span className={styles.statusMeta}>
                {current.daysRemaining > 0
                  ? `${current.daysRemaining} days remaining`
                  : 'Expired'}
              </span>
            </div>
            {/* Show dates only when the BE surfaces them or derived */}
            {(current.purchase?.createdAt ||
              current.expiresAt ||
              current.purchase?.expiryDate) && (
              <div className={styles.statusMeta}>
                <Calendar size={14} aria-hidden />
                {current.purchase?.createdAt
                  ? ` Started ${formatDate(current.purchase.createdAt, locale)} · `
                  : ' '}
                Expires{' '}
                {formatDate(
                  current.expiresAt ?? current.purchase?.expiryDate ?? null,
                  locale,
                )}
              </div>
            )}
          </>
        )}
        {!current && !isSubscriptionLoading && (
          <div className={styles.statusMeta}>
            <AlertTriangle size={14} aria-hidden /> You don't have an active
            annual subscription. Pick a plan below to get started.
          </div>
        )}
      </section>

      {/* PLAN CATALOGUE — hidden for users with an active subscription and while loading */}
      {!featureDisabled && !isSubscriptionLoading && !hasActiveSubscription && (
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
          ) : plansError ? (
            <ErrorBanner
              message={plansError.message}
              retry={
                <button type="button" onClick={() => void fetchPlans()}>
                  Retry
                </button>
              }
            />
          ) : plans.length === 0 ? (
            <div className={styles.empty}>
              No subscription plans are available for your role right now.
            </div>
          ) : (
            <div className={styles.plansGrid}>
              {plans.map((plan) => {
                const selected = plan.id === selectedPlanId;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    className={`${styles.planCard} ${
                      selected ? styles.planCardSelected : ''
                    }`}
                    onClick={() => setSelectedPlanId(plan.id)}
                    aria-pressed={selected}
                    data-testid={`plan-card-${plan.billingCycle}`}
                    data-plan-id={plan.id}
                    data-price-vnd={plan.price}
                  >
                    <span className={styles.planDuration}>
                      {billingCycleLabel(plan.billingCycle)}
                    </span>
                    <span className={styles.planPrice}>
                      {formatVnd(plan.price)}{' '}
                      <span className={styles.planPriceCurrency}>VND</span>
                    </span>
                    <span className={styles.planRolePill}>{plan.userRole}</span>
                    <ul className={styles.planFeatures}>
                      <li className={styles.planFeature}>
                        Full Researcher / Lecturer workspace access for{' '}
                        {billingCycleMonths(plan.billingCycle)} month
                        {billingCycleMonths(plan.billingCycle) !== 1 ? 's' : ''}
                      </li>
                      <li className={styles.planFeature}>
                        Forum read + interact
                      </li>
                      <li className={styles.planFeature}>
                        Submit, edit, and manage your materials and submissions
                      </li>
                    </ul>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ACTION ROW — hidden for users with an active subscription and while loading */}
      {!featureDisabled && !isSubscriptionLoading && !hasActiveSubscription && (
        <div className={styles.actionRow}>
          <Button
            onClick={() => void handleProceedToPay()}
            disabled={
              !selectedPlan || isOrdering || plansLoading || plansError !== null
            }
            data-testid="proceed-to-pay"
          >
            {isOrdering ? (
              <>
                <Loader size={14} className={styles.spinningIcon} aria-hidden />{' '}
                Starting PayOS checkout…
              </>
            ) : (
              <>
                <CreditCard size={14} aria-hidden /> Pay with PayOS
              </>
            )}
          </Button>
        </div>
      )}

      {orderError && (
        <div className={styles.errorBox} role="alert">
          <AlertTriangle size={14} aria-hidden /> {orderError.message}
        </div>
      )}

      {/* PURCHASE HISTORY */}
      <section aria-labelledby="subscription-history-title">
        <div className={styles.headerBlock}>
          <span className={styles.eyebrow}>Purchase history</span>
          <h2 id="subscription-history-title" className={styles.title}>
            Recent purchases
          </h2>
        </div>
        {historyLoading ? (
          <SkeletonRow count={3} rowHeight={28} />
        ) : history.length === 0 ? (
          <div className={styles.empty}>No purchases yet.</div>
        ) : (
          <div className={styles.historyTableWrap}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Transaction</th>
                  <th>Created</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {history.map((purchase) => (
                  <tr
                    key={purchase.transactionId}
                    data-testid="history-row"
                  >
                    <td>
                      <span
                        className={`${styles.statusTag} ${
                          purchase.status === 'Paid'
                            ? styles.statusTagActive
                            : purchase.status === 'Pending'
                              ? styles.statusTagPending
                              : styles.statusTagExpired
                        }`}
                      >
                        {STATUS_ICON[purchase.status]}
                        {STATUS_LABEL[purchase.status]}
                      </span>
                    </td>
                    <td>{formatVnd(purchase.amount)} VND</td>
                    <td className={styles.transactionIdCell}>
                      {purchase.transactionId}
                    </td>
                    <td>{formatDateTime(purchase.createdAt, locale)}</td>
                    <td>{formatDate(purchase.expiryDate ?? null, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Subscription;

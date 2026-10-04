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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSubscription, clearSubscriptionCache } from '../../hooks/useSubscription';
import { useLocale, useT } from '../../i18n/I18nContext';
import { annualFeeService } from '../../services/annualFee.service';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRow } from '../../components/SkeletonRow';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Button } from '../../components/Button/Button';
import { PaymentPolicyModal } from '../../components/subscription/PaymentPolicyModal';
import { ROUTES } from '../../routes/paths';
import { AppConfig } from '../../config/app';
import type {
  AnnualFee,
  AnnualFeeBillingCycle,
  AnnualFeePurchase,
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

// The BE serialises `AnnualFeePurchaseResponse.status` as a plain `string`
// (nullable) rather than a strict enum, so the value can arrive in any
// casing — e.g. "Paid", "paid", "PAID", or even strings the BE team added
// later ("Active", "Refunded", "Completed"). The maps below are
// case-insensitive lookups; anything we don't recognise falls through to
// `STATUS_DEFAULT_LABEL` so the row never renders an empty status cell.
// The BE serialises `AnnualFeePurchaseResponse.status` as a plain `string`
// (nullable) rather than a strict enum, so the value can arrive in any
// casing or shape — e.g. "Paid", "paid", "PAID", "PENDING_PAYMENT",
// "Active", "Refunded", etc. From the user's perspective there are only
// two outcomes that matter: payment succeeded (green) or it didn't (red).
// The maps below are case-insensitive lookups; any non-success value
// (including the `PENDING_PAYMENT` raw value the BE returns when the
// user cancels a PayOS checkout) collapses to "Payment Fail".
const SUCCESS_STATUS_KEYS = new Set([
  'paid',
  'active',
  'success',
  'completed',
  'succeeded',
]);
const STATUS_LABEL: Record<string, string> = {
  Paid: 'Payment Success',
  Active: 'Payment Success',
  Success: 'Payment Success',
  Completed: 'Payment Success',
  Succeeded: 'Payment Success',
  Pending: 'Payment Fail',
  Pending_Payment: 'Payment Fail',
  PendingPayment: 'Payment Fail',
  Failed: 'Payment Fail',
  Cancelled: 'Payment Fail',
  Canceled: 'Payment Fail',
  Expired: 'Payment Fail',
  Refunded: 'Payment Fail',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  Paid: <CheckCircle2 size={14} aria-hidden />,
  Active: <CheckCircle2 size={14} aria-hidden />,
  Success: <CheckCircle2 size={14} aria-hidden />,
  Completed: <CheckCircle2 size={14} aria-hidden />,
  Succeeded: <CheckCircle2 size={14} aria-hidden />,
  Pending: <XCircle size={14} aria-hidden />,
  Pending_Payment: <XCircle size={14} aria-hidden />,
  PendingPayment: <XCircle size={14} aria-hidden />,
  Failed: <XCircle size={14} aria-hidden />,
  Cancelled: <XCircle size={14} aria-hidden />,
  Canceled: <XCircle size={14} aria-hidden />,
  Expired: <XCircle size={14} aria-hidden />,
  Refunded: <XCircle size={14} aria-hidden />,
};
// CSS modifier per status — collapses to either "success" (green) or
// "fail" (red) regardless of which non-success variant the BE sent.
const STATUS_CLASS: Record<string, string> = {
  Paid: 'statusTagActive',
  Active: 'statusTagActive',
  Success: 'statusTagActive',
  Completed: 'statusTagActive',
  Succeeded: 'statusTagActive',
  Pending: 'statusTagExpired',
  Pending_Payment: 'statusTagExpired',
  PendingPayment: 'statusTagExpired',
  Failed: 'statusTagExpired',
  Cancelled: 'statusTagExpired',
  Canceled: 'statusTagExpired',
  Expired: 'statusTagExpired',
  Refunded: 'statusTagExpired',
};

/**
 * Resolve the display label / icon / modifier for a status value coming
 * from the BE. The lookup normalises casing and tolerates unknown
 * values: anything in the success set maps to "Payment Success" (green),
 * anything else — including null/empty, raw PayOS strings like
 * `PENDING_PAYMENT`, or future non-success states — maps to
 * "Payment Fail" (red) so the cell is never blank or raw.
 */
const resolveStatusDisplay = (
  raw: string | null | undefined,
): { label: string; icon: React.ReactNode; modifier: string } => {
  const key = (raw ?? '').trim();
  if (!key) {
    return {
      label: 'Payment Fail',
      icon: <XCircle size={14} aria-hidden />,
      modifier: 'statusTagExpired',
    };
  }
  // Direct lookup first (covers PascalCase + SCREAMING_SNAKE variants).
  if (STATUS_LABEL[key]) {
    return {
      label: STATUS_LABEL[key],
      icon: STATUS_ICON[key] ?? <XCircle size={14} aria-hidden />,
      modifier: STATUS_CLASS[key] ?? 'statusTagExpired',
    };
  }
  // Case-insensitive fallback for "paid" / "PAID" / "Paid" / etc.
  const lower = key.toLowerCase();
  if (SUCCESS_STATUS_KEYS.has(lower)) {
    return {
      label: 'Payment Success',
      icon: <CheckCircle2 size={14} aria-hidden />,
      modifier: 'statusTagActive',
    };
  }
  // Unknown / non-success — surface as Payment Fail so the cell is never blank.
  return {
    label: 'Payment Fail',
    icon: <XCircle size={14} aria-hidden />,
    modifier: 'statusTagExpired',
  };
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

const ROLE_FEATURES = {
  Researcher: ['Research Papers', 'Seminars', 'Forum participation'],
  Lecturer: ['Seminars', 'Research Topics', 'Research Groups', 'Phase Reports', 'Materials'],
} as const;

export const Subscription = () => {
  const { user, effectiveRole } = useAuth();
  const location = useLocation();
  const locale = useLocale();
  const t = useT();
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

  // Two-step payment gate. First the user must read and accept the
  // Payment & No-Refund Policy in the modal; only then does the PayOS
  // popup launch. `isPolicyModalOpen` controls visibility, and
  // `pendingPurchase` carries the side-effects to run after acceptance
  // (i.e. the same fetch that used to live directly in handleProceedToPay).
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<
    | {
        planId: number;
        userId: number;
      }
    | null
  >(null);

  // Holds a handle to the PayOS checkout popup so we can detect when the
  // user finishes (or cancels) payment without a top-level navigation
  // reloading the SPA. Without this, the parent's in-memory JWT and
  // secureToken session key survive across the PayOS round-trip — which
  // is the whole point of using a popup instead of `window.location.assign`.
  const checkoutPopupRef = useRef<Window | null>(null);
  const checkoutWatchdogRef = useRef<number | null>(null);

  const [history, setHistory] = useState<AnnualFeePurchase[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const userFullName = user?.username || user?.email || 'Account';
  const currentRole =
    effectiveRole === 'Researcher' || effectiveRole === 'Lecturer'
      ? effectiveRole
      : user?.role === 'Researcher' || user?.role === 'Lecturer'
        ? user.role
        : 'Researcher';
  const roleFeatures = ROLE_FEATURES[currentRole];
  const roleLabel = currentRole;

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

  // PayOS popup-close watchdog. When the popup closes (the user either
  // completed the payment and PayOS redirected the popup back to our
  // `/subscription/return` URL, or they cancelled), pull the BE's
  // authoritative subscription state and route accordingly. We retry
  // for up to ~10 s because the PayOS webhook that flips the purchase
  // from `PENDING_PAYMENT` to `ACTIVE` can lag the popup redirect by
  // a few seconds — without the retry window the user would see a
  // misleading "payment failed" toast even though the payment actually
  // succeeded.
  //
  // The watchdog only runs while `checkoutPopupRef.current` is set
  // (i.e. the user actually opened a popup on this mount). It cleans
  // itself up on unmount so navigating away from the page doesn't
  // leave dangling timers or stale popups.
  useEffect(() => {
    if (!checkoutPopupRef.current) return undefined;

    // Track whether we've already kicked off the post-close handler so
    // the polling interval doesn't fire the success navigation twice.
    let handled = false;
    const popup = checkoutPopupRef.current;

    const POLL_MS = 500;
    // Retry budget for the BE webhook race. 10 s × 2 s backoff = ~5
    // attempts which is well above the latency we see on the BE.
    const MAX_RETRY_MS = 10_000;
    const RETRY_DELAY_MS = 2_000;

    const tick = async () => {
      // `popup.closed` is `true` once the popup window is destroyed
      // (either the user closed it or PayOS closed it after redirect).
      // Some browsers report `null` instead of `false` while the popup
      // is still mid-navigation, so we treat any truthy non-false value
      // as "still alive".
      const stillOpen = popup.closed === false || popup.closed === undefined;
      if (stillOpen || handled) return;
      handled = true;
      if (checkoutWatchdogRef.current !== null) {
        window.clearInterval(checkoutWatchdogRef.current);
        checkoutWatchdogRef.current = null;
      }
      checkoutPopupRef.current = null;

      // Burst-refetch: try immediately, then on a slow backoff, until
      // the BE reports the purchase active OR we exhaust the budget.
      const startedAt = Date.now();
      let active = false;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          clearSubscriptionCache();
          await refetchSubscription();
          // Read the latest snapshot — the hook updates internal state
          // synchronously after the fetch resolves.
          const latest = await annualFeeService.getMyCurrentSubscription();
          if (latest && !latest.isExpired) {
            active = true;
            break;
          }
        } catch {
          // Network blip — keep retrying until the budget is spent.
        }
        if (Date.now() - startedAt >= MAX_RETRY_MS) break;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }

      if (active) {
        // Refetch the recent-purchases table so the new Paid row shows up
        // immediately. The history fetch is decoupled from the
        // subscription fetch so a slow /api/AnnualFees/my-purchases call
        // doesn't block the toast or the UI update.
        void fetchHistory();
        toast.success(
          locale === 'vi'
            ? 'Thanh toán thành công! Đăng ký của bạn đã được kích hoạt.'
            : 'Payment confirmed! Your subscription is now active.',
        );
      } else {
        // Webhook hasn't propagated yet — keep the user on this page so
        // they can see the table refresh once the BE catches up. We
        // also kick off a history fetch in case the BE has the row but
        // the current-subscription endpoint is lagging.
        void fetchHistory();
        toast.warning(
          locale === 'vi'
            ? 'Chúng tôi vẫn đang xác nhận thanh toán của bạn. Bạn sẽ nhận được thông báo khi đăng ký được kích hoạt.'
            : "We're still confirming your payment. You'll be notified once your subscription is active.",
        );
      }
    };

    checkoutWatchdogRef.current = window.setInterval(() => {
      void tick();
    }, POLL_MS);

    // Defensive guard: while the PayOS popup is open, prompt the user
    // before they close the parent tab or navigate away. Closing the
    // parent mid-payment would terminate the in-memory session and the
    // user would have to log back in to see their refreshed expiry.
    // The browser ignores the custom message — only the prompt itself
    // is enforced, which is enough to prevent accidental closure.
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // eslint-disable-next-line no-param-reassign
      event.returnValue =
        'A payment is in progress. Closing this tab will cancel it. Are you sure?';
    };
    window.addEventListener('beforeunload', beforeUnload);

    return () => {
      if (checkoutWatchdogRef.current !== null) {
        window.clearInterval(checkoutWatchdogRef.current);
        checkoutWatchdogRef.current = null;
      }
      window.removeEventListener('beforeunload', beforeUnload);
      checkoutPopupRef.current = null;
    };
  }, [refetchSubscription, fetchHistory, location.pathname, locale]);

  const selectedPlan = useMemo<AnnualFee | null>(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  // Open PayOS checkout in a popup so the parent SPA stays mounted across
  // the round-trip. Background — `window.location.assign(checkoutUrl)` would
  // trigger a hard browser navigation to a third-party domain and back,
  // which re-evaluates the JS bundle on return and drops the in-memory
  // JWT and secureToken session key. The auth context would then look
  // unauthenticated on first refetch and route the user to /login. The
  // popup keeps the parent alive so the session survives intact.
  //
  // When the popup closes (PayOS redirects the popup to our
  // `/subscription/return` page and the user dismisses it after seeing
  // the confirmation), the `checkoutWatchdog` effect below calls
  // `refetchSubscription()` to pull the BE's authoritative state and
  // updates the subscription card + history table in place. The user
  // stays on this page so they can see the new expiry date and the new
  // row in "Recent purchases" without losing context.
  const openPayosCheckoutPopup = useCallback((checkoutUrl: string): Window | null => {
    if (typeof window === 'undefined') return null;
    // `noopener,noreferrer` keeps the popup from gaining a reference back
    // to the parent (defence-in-depth against PayOS-hosted content trying
    // to navigate `window.opener`). The window name is fixed so successive
    // purchases reuse the same popup rather than spawning new ones.
    const popup = window.open(
      checkoutUrl,
      'payos_checkout',
      'width=960,height=780,menubar=no,toolbar=no,location=no,noopener,noreferrer',
    );
    if (popup) {
      checkoutPopupRef.current = popup;
    }
    return popup;
  }, []);

  const startPayosPurchase = useCallback(
    async (planId: number, authenticatedUserId: number) => {
      setIsOrdering(true);
      setOrderError(null);
      try {
        const order = await annualFeeService.purchaseAnnualFee(planId, {
          userId: authenticatedUserId,
          returnUrl:
            typeof window !== 'undefined'
              ? `${window.location.origin}${ROUTES.SUBSCRIPTION_RETURN}?status=success&popup=1`
              : null,
          cancelUrl:
            typeof window !== 'undefined'
              ? `${window.location.origin}${ROUTES.SUBSCRIPTION_RETURN}?status=cancelled&popup=1`
              : null,
        });
        if (order.checkoutUrl && typeof order.checkoutUrl === 'string') {
          // Primary path — popup-based checkout. The popup is what PayOS
          // returns the user to (via our `/subscription/return` URL with
          // `&popup=1`). The popup renders a tiny self-contained splash
          // and auto-closes — it never makes authenticated BE calls, so
          // the parent tab's session is preserved. On popup close the
          // parent polls the BE and updates the subscription card +
          // history table in place.
          const popup = openPayosCheckoutPopup(order.checkoutUrl);
          if (popup) {
            return;
          }
          // Popup blocked. The parent MUST stay on this page so the in-memory
          // JWT and secureToken session key survive the PayOS round-trip —
          // a top-level redirect to `checkoutUrl` would re-evaluate the JS
          // bundle on return, drop the session, and bounce the user to
          // /login. Instead we surface a clear error and let the user
          // retry after enabling popups for this origin.
          setOrderError(
            new Error(
              'Your browser blocked the PayOS payment window. Please allow popups for this site and try again — the page will not redirect you away.',
            ),
          );
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
    },
    [openPayosCheckoutPopup],
  );

  // Step 1 of the payment flow: the user clicks "Pay with PayOS" and the
  // Payment & No-Refund Policy modal opens. We do NOT call the BE yet —
  // acceptance is a precondition so a user who closes the modal leaves
  // no pending purchase.
  const handleProceedToPay = useCallback(() => {
    if (!selectedPlan) return;
    const authenticatedUserId = user?.userId ?? null;
    if (!authenticatedUserId) {
      setOrderError(new Error('You must be signed in to purchase a subscription.'));
      return;
    }
    setOrderError(null);
    setPendingPurchase({ planId: selectedPlan.id, userId: authenticatedUserId });
    setIsPolicyModalOpen(true);
  }, [selectedPlan, user?.userId]);

  // Step 2: the user ticked the checkbox and clicked "Confirm and proceed
  // to payment". We close the modal and start the PayOS popup.
  const handlePolicyAccepted = useCallback(() => {
    const pending = pendingPurchase;
    setIsPolicyModalOpen(false);
    setPendingPurchase(null);
    if (!pending) return;
    void startPayosPurchase(pending.planId, pending.userId);
  }, [pendingPurchase, startPayosPurchase]);

  // Cancel from the modal: just close it. The pending purchase is
  // discarded — no BE call is made and no popup opens.
  const handlePolicyCancelled = useCallback(() => {
    setIsPolicyModalOpen(false);
    setPendingPurchase(null);
  }, []);

  const featureDisabled = !AppConfig.features.enableSubscriptionAccess;
  // True when the BE has returned a valid subscription that is not expired.
  // These users should see their active status — not plan selection or a pay
  // button — so they are never asked to re-subscribe.
  const hasActiveSubscription = !featureDisabled && current != null && !current.isExpired;

  return (
    <div className={styles.page} data-component="SubscriptionPage">
      <PageHeader
        title={`${roleLabel} access`}
        description={
          hasActiveSubscription
            ? `Signed in as ${userFullName}. Your ${roleLabel} subscription is active — all features are unlocked.`
            : `Signed in as ${userFullName}. Subscribe to unlock full ${roleLabel} features.`
        }
      />

      {featureDisabled && (
        <div
          className={styles.banner}
          role="status"
          aria-live="polite"
          data-testid="subscription-feature-disabled"
        >
          Annual subscription is temporarily unavailable. {roleLabel}
          features are fully accessible. Subscription payments will resume
          once this service is back online.
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
            <strong>Subscription active.</strong> All {roleLabel} workspace features ({roleFeatures.join(', ')}) are fully accessible.
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
                ? current.annualFee?.name?.trim() ||
                  t(
                    'subscription.status.genericName',
                    'Annual subscription',
                  )
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
            </div>
            {/* Show dates only when the BE surfaces them or derived. The
                calendar + expiry text sits on one row (icon inline with
                text) so the user sees when their subscription ends at a
                glance. We intentionally don't show a "days remaining"
                countdown — for plans like 6 months users would do the
                arithmetic and then argue the number is "wrong", which is
                a worse experience than just showing the expiry directly. */}
            {(current.purchase?.createdAt ||
              current.expiresAt ||
              current.purchase?.expiryDate) && (
              <div className={`${styles.statusMeta} ${styles.statusMetaInline}`}>
                <Calendar size={14} aria-hidden />
                <span>
                  Expires on{' '}
                  {formatDate(
                    current.expiresAt ?? current.purchase?.expiryDate ?? null,
                    locale,
                  )}
                  {current.purchase?.createdAt && (
                    <>
                      {' · started '}
                      {formatDate(current.purchase.createdAt, locale)}
                    </>
                  )}
                </span>
              </div>
            )}
          </>
        )}
        {!current && !isSubscriptionLoading && (
          <div className={`${styles.statusMeta} ${styles.statusMetaInline}`}>
            <AlertTriangle size={14} aria-hidden /> You don't have an active
            annual subscription. Pick a plan below to get started.
          </div>
        )}
      </section>

      {/* PLAN CATALOGUE — shown to everyone (active subscribers included)
          so users can compare prices and prepare a budget for renewal. For
          users with an active subscription the section header explicitly
          says the pay button below is disabled until expiry. */}
      {!featureDisabled && !isSubscriptionLoading && (
        <section aria-labelledby="subscription-plans-title">
          <div className={styles.headerBlock}>
            <span className={styles.eyebrow}>
              {hasActiveSubscription
                ? 'Plans & pricing'
                : 'Choose a plan'}
            </span>
            <h2 id="subscription-plans-title" className={styles.title}>
              Subscription plans
            </h2>
            <p className={styles.description}>
              {hasActiveSubscription
                ? 'Your current subscription is still active. The prices below are shown so you can plan your renewal budget — payment is unlocked automatically when your current plan expires.'
                : 'Pick a plan to start your subscription. You can compare options side by side before paying.'}
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
                        Full workspace access for{' '}
                        {billingCycleMonths(plan.billingCycle)} month
                        {billingCycleMonths(plan.billingCycle) !== 1 ? 's' : ''}
                      </li>
                      <li className={styles.planFeature}>
                        Forum read + interact
                      </li>
                      <li className={styles.planFeature}>
                        Access {roleFeatures.join(', ')}
                      </li>
                    </ul>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ACTION ROW — shown to everyone (active subscribers included). For
          users with an active subscription the pay button stays visible but
          disabled, with a clear notice explaining that payment unlocks when
          the current plan expires. The "Read full policy" link is still
          available so users can review the terms while planning their budget. */}
      {!featureDisabled && !isSubscriptionLoading && (
        <div className={styles.actionRow}>
          {hasActiveSubscription && (
            <div
              className={styles.activeSubscriberNotice}
              role="status"
              data-testid="active-subscriber-notice"
            >
              <AlertTriangle size={16} aria-hidden />
              <span>
                You already have an active subscription
                {current?.expiresAt
                  ? ` until ${formatDate(current.expiresAt, locale)}`
                  : current?.purchase?.expiryDate
                    ? ` until ${formatDate(current.purchase.expiryDate, locale)}`
                    : ''}
                . Payment is locked until your current plan expires so we
                don't double-charge you. Use this page to compare prices and
                prepare your renewal budget — the pay button will unlock
                automatically when your subscription is up for renewal.
              </span>
            </div>
          )}
          <div className={styles.actionRowButtons}>
            <Button
              onClick={() => void handleProceedToPay()}
              disabled={
                !selectedPlan ||
                isOrdering ||
                plansLoading ||
                plansError !== null ||
                hasActiveSubscription
              }
              data-testid="proceed-to-pay"
            >
              {isOrdering ? (
                <>
                  <Loader size={14} className={styles.spinningIcon} aria-hidden />{' '}
                  Starting PayOS checkout…
                </>
              ) : hasActiveSubscription ? (
                <>
                  <CreditCard size={14} aria-hidden /> Pay with PayOS (unlocks at renewal)
                </>
              ) : (
                <>
                  <CreditCard size={14} aria-hidden /> Pay with PayOS
                </>
              )}
            </Button>
            <button
              type="button"
              className={styles.policyLinkBtn}
              onClick={() => {
                if (!selectedPlan) return;
                const authenticatedUserId = user?.userId ?? null;
                if (!authenticatedUserId) {
                  setOrderError(new Error('You must be signed in to view the policy.'));
                  return;
                }
                setOrderError(null);
                setPendingPurchase({ planId: selectedPlan.id, userId: authenticatedUserId });
                setIsPolicyModalOpen(true);
              }}
              disabled={!selectedPlan || isOrdering}
              data-testid="read-payment-policy"
              aria-label="Read the full Payment & No-Refund Policy"
            >
              <FileText size={14} aria-hidden /> Read full policy
            </button>
          </div>
          <p className={styles.policyHint}>
            {hasActiveSubscription
              ? 'You can still review the payment policy now — it only takes effect when you actually start a new purchase.'
              : 'By continuing, you confirm that all annual subscription payments are final and non-refundable once processed.'}
          </p>
        </div>
      )}

      {orderError && (
        <div className={styles.errorBox} role="alert">
          <AlertTriangle size={14} aria-hidden /> {orderError.message}
        </div>
      )}

      {/* PAYMENT POLICY MODAL — opens before PayOS checkout. Acceptance is
          required (checkbox + explicit confirm button) before the popup
          launches. The admin-editable policy text is fetched live from
          Firebase each time the modal opens. */}
      {isPolicyModalOpen && selectedPlan && (
        <PaymentPolicyModal
          isOpen={isPolicyModalOpen}
          planLabel={`${billingCycleLabel(selectedPlan.billingCycle)} — ${formatVnd(selectedPlan.price)} VND`}
          planId={selectedPlan.id}
          onCancel={handlePolicyCancelled}
          onAccept={handlePolicyAccepted}
        />
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
                  <th>Purchase Date</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {history.map((purchase) => {
                  const status = resolveStatusDisplay(purchase.status);
                  return (
                    <tr
                      key={purchase.transactionId}
                      data-testid="history-row"
                    >
                      <td>
                        <span
                          className={`${styles.statusTag} ${
                            styles[status.modifier] ?? styles.statusTagExpired
                          }`}
                          data-testid="history-status"
                          data-status={purchase.status ?? ''}
                        >
                          {status.icon}
                          {status.label}
                        </span>
                      </td>
                      <td>{formatVnd(purchase.amount)} VND</td>
                      <td>{formatDateTime(purchase.createdAt, locale)}</td>
                      <td>{formatDate(purchase.expiryDate ?? null, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Subscription;

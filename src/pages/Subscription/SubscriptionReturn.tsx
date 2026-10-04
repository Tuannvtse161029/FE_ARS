/**
 * SubscriptionReturn — landing page PayOS redirects users to after a
 * payment attempt. The page NEVER activates access from the browser
 * query string.
 *
 * Two render paths:
 *
 *   1. Top-level (parent tab) — `?popup` is absent. The page refetches
 *      subscription state from the BE via
 *      `annualFeeService.getMyCurrentSubscription()`. Only a
 *      BE-confirmed ACTIVE subscription unlocks the workspace. The user
 *      can navigate back to the subscription page manually.
 *
 *   2. Popup (PayOS checkout window) — `?popup=1`. The popup runs in
 *      its own JS context that does NOT share the parent's
 *      `secureToken` in-memory session key, so any authenticated BE
 *      call from the popup would 401, clear the shared on-disk
 *      envelope, and bounce BOTH windows to /login. To prevent that we
 *      render a tiny self-contained splash here, never touch the API,
 *      and auto-close the popup after a short delay so the parent tab
 *      can resume its polling/refetch loop.
 *
 * Reads PayOS return params:
 *   - `code`         — PayOS response code. `00` = success.
 *   - `status`       — PayOS status, e.g. `success` | `cancelled` | `failed`
 *   - `orderCode` / `order_code` / `id` — PayOS order code (transactionId)
 *   - `cancel`       — PayOS sends `true` when the user cancels
 *   - `popup=1`      — Marker that we are inside the PayOS checkout popup.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../../routes/paths';
import { annualFeeService } from '../../services/annualFee.service';
import { useSubscription } from '../../hooks/useSubscription';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { AppConfig } from '../../config/app';
import { CheckCircle2, XCircle } from 'lucide-react';
import styles from './Subscription.module.css';

type VerificationState =
  | 'verifying'
  | 'active'
  | 'pending'
  | 'failed'
  | 'expired';

/**
 * Auto-close delay for the PayOS popup. Long enough for the splash to
 * render and the user to see the confirmation message, short enough
 * that the round-trip doesn't feel slow.
 */
const POPUP_AUTO_CLOSE_MS = 2500;

/**
 * Tiny self-contained splash rendered inside the PayOS checkout popup.
 * MUST NOT trigger any BE call (the popup has no in-memory session key,
 * so any axios call would 401 and bounce the user to /login). The
 * parent tab's polling effect picks up the new subscription state when
 * this window closes.
 */
const PopupReturnSplash = ({
  status,
}: {
  status: 'success' | 'cancelled' | 'failed' | 'unknown';
}) => {
  const isSuccess = status === 'success';
  // Auto-close the popup. `window.close()` only works for windows that
  // were opened by a script (which the PayOS popup was, via
  // `window.open` on the Subscription page).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.close();
    }, POPUP_AUTO_CLOSE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className={styles.page}
      data-component="SubscriptionReturnPopupSplash"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: isSuccess
              ? 'rgba(34, 197, 94, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
            color: isSuccess ? '#16a34a' : '#dc2626',
            marginBottom: 16,
          }}
        >
          {isSuccess ? (
            <CheckCircle2 size={36} aria-hidden />
          ) : (
            <XCircle size={36} aria-hidden />
          )}
        </div>
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            margin: '0 0 8px',
            color: 'var(--ars-ink, #1a202c)',
          }}
        >
          {isSuccess
            ? 'Payment confirmed'
            : status === 'cancelled'
              ? 'Payment cancelled'
              : status === 'failed'
                ? 'Payment failed'
                : 'Payment complete'}
        </h1>
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--ars-ink-muted, #4a5568)',
            margin: 0,
          }}
        >
          {isSuccess
            ? 'This window will close automatically. Your subscription will be active in the main tab in a moment.'
            : 'This window will close automatically. You can return to the subscription page to try again.'}
        </p>
      </div>
    </div>
  );
};

/**
 * Top-level (parent tab) flow — runs the actual BE verification.
 */
const SubscriptionReturnTopLevel = ({
  payosCode,
  payosStatus,
  cancelFlag,
  orderCode,
}: {
  payosCode: string | null;
  payosStatus: string;
  cancelFlag: boolean;
  orderCode: string | null;
}) => {
  const navigate = useNavigate();
  const { refetch, current } = useSubscription();

  const [state, setState] = useState<VerificationState>('verifying');
  const [message, setMessage] = useState<string>(
    'Payment received. We are verifying your subscription.',
  );

  const verify = useCallback(async () => {
    setState('verifying');
    setMessage('Payment received. We are verifying your subscription.');

    try {
      const payosSaysCancelled =
        cancelFlag ||
        payosStatus === 'cancelled' ||
        payosStatus === 'failed' ||
        (payosCode !== null && payosCode !== '00');

      if (payosSaysCancelled) {
        setState('failed');
        setMessage(
          'You cancelled the payment. Your subscription has not been activated.',
        );
        return;
      }

      // If we have an orderCode and payment was not cancelled, confirm with BE immediately
      if (orderCode) {
        await annualFeeService.confirmPayment(orderCode);
      }

      // Authoritative check: ask the BE for the user's current subscription.
      await refetch();

      // The hook will populate `current`. Read the latest snapshot.
      const sub = current ?? (await annualFeeService.getMyCurrentSubscription());

      const isPaid = sub?.purchase == null || sub.purchase.status === 'Paid';
      if (sub && !sub.isExpired && isPaid) {
        setState('active');
        setMessage(
          'Payment confirmed. Your subscription is active — you can return to your workspace.',
        );
        return;
      }

      if (sub && sub.isExpired) {
        setState('expired');
        setMessage(
          'Your previous subscription has expired. The payment may not have been applied yet. Please check back in a moment.',
        );
        return;
      }

      // PayOS redirect said success but BE has no active sub yet — typical
      // race while the webhook is propagating.
      setState('pending');
      setMessage(
        'Your payment is still being processed. We will update this page as soon as the platform confirms it.',
      );
    } catch (caught) {
      setState('failed');
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Failed to verify payment. Please try again.',
      );
    }
  }, [refetch, current, orderCode, payosCode, payosStatus, cancelFlag]);

  useEffect(() => {
    void verify();
    // We deliberately exclude `current` from deps — it changes after `refetch()`
    // but we only want the verify flow to run once per PayOS return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const featureDisabled = !AppConfig.features.enableSubscriptionAccess;

  return (
    <div className={styles.page} data-component="SubscriptionReturnPage">
      <PageHeader
        title={featureDisabled ? 'Subscription' : 'Verifying your payment'}
        description={`Reference: ${orderCode ?? '—'}${
          payosCode ? ` · PayOS code: ${payosCode}` : ''
        }${payosStatus ? ` · status: ${payosStatus}` : ''}`}
      />

      {featureDisabled && (
        <div
          className={styles.banner}
          role="status"
          aria-live="polite"
          data-testid="subscription-return-feature-disabled"
        >
          Annual subscription is temporarily unavailable. Researcher and
          Lecturer features are fully accessible.
        </div>
      )}

      <section
        className={styles.statusCard}
        aria-labelledby="subscription-return-status"
      >
        <div className={styles.headerBlock}>
          <h2 id="subscription-return-status" className={styles.title}>
            {state === 'verifying'
              ? 'Verifying payment…'
              : state === 'active'
                ? 'Subscription active'
                : state === 'pending'
                  ? 'Payment pending'
                  : state === 'expired'
                    ? 'Awaiting activation'
                    : 'Verification failed'}
          </h2>
        </div>
        <p className={styles.description}>{message}</p>
        <div className={styles.actionRow}>
          {state === 'active' && (
            <Button onClick={() => navigate(ROUTES.HOME, { replace: true })}>
              Go to workspace
            </Button>
          )}
          {(state === 'failed' || state === 'pending' || state === 'expired') && (
            <Button onClick={() => navigate(ROUTES.SUBSCRIPTION, { replace: true })}>
              Back to subscription
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => void verify()}
            disabled={state === 'verifying'}
          >
            Re-check now
          </Button>
        </div>
      </section>
    </div>
  );
};

export const SubscriptionReturn = () => {
  const [searchParams] = useSearchParams();

  // PayOS may pass several shapes. Pull the most reliable signal we have.
  const payosCode = searchParams.get('code');
  const payosStatus = (searchParams.get('status') ?? '').toLowerCase();
  const cancelFlag =
    searchParams.get('cancel') === 'true' ||
    searchParams.get('cancel') === '1';
  const orderCode =
    searchParams.get('orderCode') ??
    searchParams.get('order_code') ??
    searchParams.get('id') ??
    null;
  // The Subscription page tags the return URL it sends to PayOS with
  // `&popup=1` so the PayOS checkout window lands here in popup mode.
  const isPopupWindow = searchParams.get('popup') === '1';

  if (isPopupWindow) {
    const splashStatus: 'success' | 'cancelled' | 'failed' | 'unknown' =
      cancelFlag || payosStatus === 'cancelled'
        ? 'cancelled'
        : payosStatus === 'failed' || (payosCode !== null && payosCode !== '00')
          ? 'failed'
          : payosStatus === 'success' || payosCode === '00'
            ? 'success'
            : 'unknown';
    return <PopupReturnSplash status={splashStatus} />;
  }

  return (
    <SubscriptionReturnTopLevel
      payosCode={payosCode}
      payosStatus={payosStatus}
      cancelFlag={cancelFlag}
      orderCode={orderCode}
    />
  );
};

export default SubscriptionReturn;

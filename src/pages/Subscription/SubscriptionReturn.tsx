/**
 * SubscriptionReturn — landing page PayOS redirects users to after a
 * payment attempt. The page NEVER activates access from the browser
 * query string. It shows "Payment received. We are verifying your
 * subscription." and refetches subscription state from the BE via
 * `annualFeeService.getMyCurrentSubscription()`. Only a BE-confirmed
 * ACTIVE subscription unlocks the workspace.
 *
 * Reads PayOS return params:
 *   - `code`         — PayOS response code. `00` = success.
 *   - `status`       — PayOS status, e.g. `success` | `cancelled` | `failed`
 *   - `orderCode` / `order_code` / `id` — PayOS order code (transactionId)
 *   - `cancel`       — PayOS sends `true` when the user cancels
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../../routes/paths';
import { annualFeeService } from '../../services/annualFee.service';
import { useSubscription } from '../../hooks/useSubscription';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { AppConfig } from '../../config/app';
import styles from './Subscription.module.css';

type VerificationState =
  | 'verifying'
  | 'active'
  | 'pending'
  | 'failed'
  | 'expired';

export const SubscriptionReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refetch, current } = useSubscription();

  const [state, setState] = useState<VerificationState>('verifying');
  const [message, setMessage] = useState<string>(
    'Payment received. We are verifying your subscription.',
  );

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

  const verify = useCallback(async () => {
    setState('verifying');
    setMessage('Payment received. We are verifying your subscription.');

    try {
      // Authoritative check: ask the BE for the user's current subscription.
      await refetch();

      // The hook will populate `current`. Read the latest snapshot.
      const sub = current ?? (await annualFeeService.getMyCurrentSubscription());

      const payosSaysCancelled = cancelFlag || payosStatus === 'cancelled' || payosStatus === 'failed' ||
        (payosCode !== null && payosCode !== '00');

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

      if (payosSaysCancelled) {
        setState('failed');
        setMessage(
          'You cancelled the payment. Your subscription has not been activated.',
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
  }, [refetch, current, payosCode, payosStatus, cancelFlag]);

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
        eyebrow="ARS subscription"
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

export default SubscriptionReturn;

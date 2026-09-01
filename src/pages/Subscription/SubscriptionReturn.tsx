/**
 * SubscriptionReturn — landing page PayOS redirects users to after a
 * payment attempt. The page NEVER activates access from the browser
 * query string. It shows "Payment received. We are verifying your
 * subscription." and refetches subscription state from the BE. Only a
 * BE-confirmed ACTIVE subscription unlocks the workspace.
 *
 * TEMPORARY DISABLED STATE: when `AppConfig.features.enableSubscriptionAccess`
 * is `false`, the page shows a "feature disabled" banner and does not
 * attempt payment verification. See `src/config/app.ts`.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../../routes/paths';
import { subscriptionService } from '../../services/subscription.service';
import { useSubscription } from '../../hooks/useSubscription';
import { SubscriptionBackendUnavailableError } from '../../types/subscription';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { AppConfig } from '../../config/app';
import styles from './Subscription.module.css';

type VerificationState =
  | 'verifying'
  | 'active'
  | 'pending'
  | 'failed'
  | 'api-missing';

export const SubscriptionReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refetch } = useSubscription();

  const [state, setState] = useState<VerificationState>('verifying');
  const [message, setMessage] = useState<string>(
    'Payment received. We are verifying your subscription.',
  );

  const orderCode =
    searchParams.get('orderCode') ??
    searchParams.get('order_code') ??
    searchParams.get('id') ??
    null;
  const payosStatus = (searchParams.get('status') ?? '').toLowerCase();

  const verify = useCallback(async () => {
    if (!orderCode) {
      // No order code at all → tell the user we couldn't identify the
      // payment, but DO NOT grant access.
      setState('failed');
      setMessage(
        'We could not identify your payment. Please return to your subscription page and try again.',
      );
      return;
    }

    setState('verifying');
    setMessage('Payment received. We are verifying your subscription.');

    try {
      const status = await subscriptionService.getPaymentStatus(orderCode);
      if (status.status === 'PAID') {
        // Authoritative check: ask the BE for the linked subscription.
        await refetch();
        setState('active');
        setMessage(
          'Payment confirmed. Your subscription is active — you can return to your workspace.',
        );
      } else if (status.status === 'PENDING') {
        setState('pending');
        setMessage(
          'Your payment is still being processed. We will update this page as soon as the platform confirms it.',
        );
      } else if (status.status === 'FAILED' || status.status === 'CANCELLED') {
        setState('failed');
        setMessage(
          status.status === 'CANCELLED'
            ? 'You cancelled the payment. Your subscription has not been activated.'
            : 'Payment was not completed. Please try again from your subscription page.',
        );
      } else {
        setState('failed');
        setMessage(
          'We could not verify your payment. Please contact support if you believe this is an error.',
        );
      }
    } catch (caught) {
      if (caught instanceof SubscriptionBackendUnavailableError) {
        setState('api-missing');
        setMessage(
          'Subscription payment integration awaiting backend API and VND pricing configuration.',
        );
        return;
      }
      setState('failed');
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'Failed to verify payment. Please try again.',
      );
    }
  }, [orderCode, refetch]);

  useEffect(() => {
    void verify();
  }, [verify]);

  // Feature is temporarily disabled — do not attempt payment verification.
  const featureDisabled = !AppConfig.features.enableSubscriptionAccess;

  return (
    <div className={styles.page} data-component="SubscriptionReturnPage">
      <PageHeader
        eyebrow="ARS subscription"
        title={featureDisabled ? 'Subscription' : 'Verifying your payment'}
        description={`Reference: ${orderCode ?? '—'}${
          payosStatus ? ` · PayOS status: ${payosStatus}` : ''
        }`}
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
                  : state === 'api-missing'
                    ? 'Awaiting backend'
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
          {(state === 'failed' || state === 'api-missing' || state === 'pending') && (
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

      {/* Defensive: never render a hidden "Access granted" state.
          The page never unlocks the workspace itself — it only reports
          what the BE has confirmed. */}
    </div>
  );
};

export default SubscriptionReturn;

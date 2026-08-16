import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { paymentService } from '../../services/payment.service';
import { ROUTES } from '../../routes/paths';
import styles from './CheckoutReturn.module.css';

/**
 * PayOS redirect target.
 *
 * PayOS redirects the browser to the `returnUrl` we sent in
 * PaymentCreateRequest. We configured that URL to land here with
 * ?orderCode=&status=&code= appended. We then call
 *   - paymentService.getSuccess(orderCode) when status === 'PAID'
 *   - paymentService.getCancel(orderCode)  otherwise
 * to confirm with the BE, then bounce to the wallet.
 */
const CheckoutReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderCode = searchParams.get('orderCode');
  const status = searchParams.get('status');
  const code = searchParams.get('code');

  const [confirming, setConfirming] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderCode) {
      setError('Missing orderCode in return URL.');
      setConfirming(false);
      return;
    }

    let cancelled = false;
    const confirm = async () => {
      try {
        if (status === 'PAID') {
          await paymentService.getSuccess(orderCode);
        } else {
          await paymentService.getCancel(orderCode);
        }
        if (!cancelled) {
          setConfirming(false);
          // Brief delay so the user sees the success/failure screen.
          setTimeout(() => navigate(ROUTES.DASHBOARD), 1500);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to confirm payment.');
          setConfirming(false);
        }
      }
    };
    void confirm();
    return () => {
      cancelled = true;
    };
  }, [orderCode, status, navigate]);

  const paid = status === 'PAID';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {confirming ? (
          <>
            <h2 className={styles.title}>Confirming your payment…</h2>
            <p className={styles.subtitle}>
              Order: <code>{orderCode ?? '—'}</code>
            </p>
          </>
        ) : error ? (
          <>
            <h2 className={styles.titleError}>We couldn't confirm your payment</h2>
            <p className={styles.subtitle}>{error}</p>
            <button className={styles.btn} onClick={() => navigate(ROUTES.DASHBOARD)}>
              Back to dashboard
            </button>
          </>
        ) : paid ? (
          <>
            <h2 className={styles.titleSuccess}>Payment successful</h2>
            <p className={styles.subtitle}>
              Order <code>{orderCode}</code> (code: {code ?? '—'}) has been recorded.
            </p>
            <p className={styles.muted}>Redirecting you back…</p>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Payment cancelled</h2>
            <p className={styles.subtitle}>
              Order <code>{orderCode}</code> was cancelled.
            </p>
            <button className={styles.btn} onClick={() => navigate(ROUTES.DASHBOARD)}>
              Back to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckoutReturn;

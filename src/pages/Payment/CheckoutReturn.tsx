import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { paymentService } from '../../services/payment.service';
import { walletService } from '../../services/wallet.service';
import { ROUTES } from '../../routes/paths';
import styles from './CheckoutReturn.module.css';

/**
 * PayOS redirect target.
 *
 * PayOS redirects the browser to the `returnUrl` we sent in
 * PaymentCreateRequest. We configured that URL to land here with
 *   ?orderCode=&status=&code=
 * appended. The query params are NOT proof of payment — we must call
 *   - paymentService.getSuccess(orderCode, status, code) when status === 'PAID'
 *   - paymentService.getCancel(orderCode)                  otherwise
 * to confirm with the BE, then re-fetch the wallet so the header pill
 * reflects the new balance.
 */
type ConfirmationState =
  | { kind: 'confirming' }
  | { kind: 'success' }
  | { kind: 'cancelled' }
  | { kind: 'pending' }
  | { kind: 'failed'; message: string };

const normalizeStatus = (raw: string | null): string => (raw ?? '').trim().toUpperCase();

const CheckoutReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderCode = searchParams.get('orderCode');
  const status = searchParams.get('status');
  const code = searchParams.get('code');

  const [state, setState] = useState<ConfirmationState>({ kind: 'confirming' });
  const [refetchedBalance, setRefetchedBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!orderCode) {
      setState({ kind: 'failed', message: 'Missing orderCode in return URL.' });
      return;
    }

    let cancelled = false;
    const confirm = async (): Promise<void> => {
      const normalized = normalizeStatus(status);
      try {
        if (normalized === 'PAID') {
          await paymentService.getSuccess(orderCode, status ?? undefined, code ?? undefined);
        } else if (normalized === 'CANCELLED') {
          await paymentService.getCancel(orderCode);
        } else {
          // PENDING / PROCESSING / unknown — try cancel as a safe default so
          // the BE clears the order from its open-payOS state. We never
          // treat the query params as proof of payment.
          await paymentService.getCancel(orderCode);
        }
        if (cancelled) return;

        // Refetch authoritative wallet state from the BE before declaring
        // success. The wallet pill and any listeners will reflect the new
        // balance once the parent component observes the next refetch.
        try {
          const wallets = await walletService.getAll();
          const w = wallets[0] ?? null;
          if (w && typeof w.balance === 'number') {
            setRefetchedBalance(w.balance);
          }
        } catch {
          // Wallet refresh failures don't block the success/cancel screen —
          // the header pill will eventually catch up on its own refetch.
        }

        if (cancelled) return;

        if (normalized === 'PAID') {
          setState({ kind: 'success' });
          setTimeout(() => navigate(ROUTES.FORUM), 2500);
        } else if (normalized === 'CANCELLED') {
          setState({ kind: 'cancelled' });
        } else {
          // Treat anything other than PAID/CANCELLED as pending. The user
          // can retry from the wallet top-up modal.
          setState({ kind: 'pending' });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'failed',
          message:
            err instanceof Error ? err.message : 'Failed to confirm payment.',
        });
      }
    };
    void confirm();
    return () => {
      cancelled = true;
    };
  }, [orderCode, status, code, navigate]);

  if (state.kind === 'confirming') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.title}>Confirming your PayOS payment…</h2>
          <p className={styles.subtitle}>
            Order: <code>{orderCode ?? '—'}</code>
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === 'failed') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.titleError}>We couldn't confirm your payment</h2>
          <p className={styles.subtitle}>{state.message}</p>
          <div className={styles.actions}>
            <button className={styles.btn} onClick={() => navigate(ROUTES.FORUM)}>
              Back to forums
            </button>
            <button
              className={styles.btnSecondary}
              onClick={() => navigate(ROUTES.HOME)}
            >
              Try again from Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'success') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.titleSuccess}>Payment successful</h2>
          <p className={styles.subtitle}>
            Order <code>{orderCode}</code> (code: {code ?? '—'}) has been
            recorded.
          </p>
          {refetchedBalance !== null ? (
            <p className={styles.subtitle}>
              New balance:{' '}
              <strong>
                {refetchedBalance.toLocaleString('vi-VN')} VND
              </strong>
            </p>
          ) : null}
          <p className={styles.muted}>Redirecting you back…</p>
        </div>
      </div>
    );
  }

  if (state.kind === 'cancelled') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.title}>Payment cancelled</h2>
          <p className={styles.subtitle}>
            Order <code>{orderCode}</code> was cancelled.
          </p>
          <button className={styles.btn} onClick={() => navigate(ROUTES.FORUM)}>
            Back to forums
          </button>
        </div>
      </div>
    );
  }

  // PENDING / PROCESSING / unknown status — give the user a clear path to retry.
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.title}>Payment pending</h2>
        <p className={styles.subtitle}>
          We haven't confirmed order <code>{orderCode}</code> yet. PayOS may
          still be processing the transfer.
        </p>
        <p className={styles.muted}>
          You can safely close this tab. Your wallet will update once PayOS
          notifies us, or you can retry from the wallet top-up modal.
        </p>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={() => navigate(ROUTES.FORUM)}>
            Back to forums
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => navigate(ROUTES.HOME)}
          >
            Retry from Wallet
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutReturn;
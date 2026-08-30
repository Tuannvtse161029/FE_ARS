import { useEffect, useMemo, useRef, useState } from 'react';
import { X, QrCode, Wallet as WalletIcon, ArrowLeft, ExternalLink } from 'lucide-react';
import { useCreatePaymentLink } from '../../hooks/useCreatePaymentLink';
import { ROUTES } from '../../routes/paths';
import styles from './WalletTopUpModal.module.css';

const QUICK_AMOUNTS_VND = [50_000, 100_000, 200_000, 500_000, 1_000_000];
const MIN_AMOUNT_VND = 10_000;
const MAX_AMOUNT_VND = 50_000_000;

interface WalletTopUpModalProps {
  isOpen: boolean;
  currentUserId?: number | null;
  // The BE's wallet id for the user. Must be a positive integer — never null,
  // undefined, or 0. The parent is responsible for fetching the wallet before
  // opening this modal. When missing the submit button is disabled and a
  // recovery message is shown.
  currentWalletId?: number | null;
  currentBalance: number | null;
  // Called whenever the wallet balance changes (after BE confirmation).
  // The parent MUST refetch the wallet — this callback only signals.
  onSuccess: (newBalance: number) => void;
  // Called for any toast-style message (success/error).
  onMessage: (text: string, type: 'success' | 'error') => void;
  onClose: () => void;
}

type Step = 'amount' | 'qr';

interface PendingTopUp {
  amountVnd: number;
  reference: string;
  createdAt: number;
  // ── BE response fields (PaymentLink from src/types/domain.ts) ──
  // `orderCode` is the PayOS-side transaction reference returned by
  // `/api/Payment/create-link`.
  orderCode?: string | number;
  // `qrCode` is a base64 PNG / SVG returned by the BE.
  qrCode?: string;
  // `checkoutUrl` is the PayOS redirect URL returned by the BE.
  checkoutUrl?: string;
}

const formatVnd = (n: number): string => n.toLocaleString('vi-VN');

const isAbsoluteHttpUrl = (s: string): boolean => {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export function WalletTopUpModal({
  isOpen,
  currentUserId,
  currentWalletId,
  currentBalance,
  onSuccess,
  onMessage,
  onClose,
}: WalletTopUpModalProps): JSX.Element | null {
  // `currentBalance` is intentionally forwarded for callback parity with the
  // previous VNPay flow; the PayOS success path no longer computes a local
  // balance — the parent always re-fetches the wallet after onSuccess.
  void currentBalance;
  void onSuccess;
  const [step, setStep] = useState<Step>('amount');
  const [amountText, setAmountText] = useState('100,000');
  const [pending, setPending] = useState<PendingTopUp | null>(null);
  const { create: createPaymentLink, isLoading: isCreatingLink, reset: resetLink } =
    useCreatePaymentLink();
  const [submitGuard, setSubmitGuard] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const closeDialog = (): void => {
    onClose();
    openerRef.current?.focus();
  };

  // Reset internal state every time the modal opens. Closing keeps the state
  // until the next open so a partially-typed amount isn't lost on a tooltip.
  // We intentionally exclude `resetLink` from the deps because the hook
  // returns a fresh function identity on every render — including it would
  // wipe the user's typed amount mid-interaction.
  useEffect(() => {
    if (isOpen) {
      setStep('amount');
      setAmountText('100,000');
      setPending(null);
      setSubmitGuard(false);
      resetLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCreatingLink) {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCreatingLink, isOpen]);

  const parsedAmount = useMemo(() => {
    const stripped = amountText.replace(/[^\d]/g, '');
    if (!stripped) return null;
    const n = Number(stripped);
    if (!Number.isFinite(n)) return null;
    return n;
  }, [amountText]);

  const isAmountValid =
    parsedAmount !== null &&
    parsedAmount >= MIN_AMOUNT_VND &&
    parsedAmount <= MAX_AMOUNT_VND;

  const handleConfirmPay = async (): Promise<void> => {
    if (!isAmountValid || parsedAmount === null) return;
    // Reject when wallet is missing — never fall back to 0.
    if (!currentWalletId || currentWalletId <= 0) {
      onMessage('Your wallet information could not be loaded. Refresh and try again.', 'error');
      return;
    }
    // Disable duplicate submission while the request is in flight.
    if (submitGuard || isCreatingLink) return;
    const amount = parsedAmount;
    // The return URL points at the existing /payment/return route. The
    // CheckoutReturn page will confirm with the BE before showing success.
    const returnPath = ROUTES.PAYMENT_RETURN;
    const baseUrl = window.location.origin;
    const returnUrl = `${baseUrl}${returnPath}?status=success&orderCode={orderCode}`;
    const cancelUrl = `${baseUrl}${returnPath}?status=CANCELLED&orderCode={orderCode}`;

    setSubmitGuard(true);
    const beLink = await createPaymentLink({
      amount,
      description: `Wallet top-up ${formatVnd(amount)} VND`,
      userId: currentUserId ?? undefined,
      walletId: currentWalletId,
      returnUrl,
      cancelUrl,
    });
    setSubmitGuard(false);

    const link = beLink ?? null;
    if (!link || (!link.checkoutUrl && !link.qrCode)) {
      onMessage('PayOS did not return a usable checkout link or QR code. Please try again.', 'error');
      return;
    }

    const next: PendingTopUp = {
      amountVnd: amount,
      reference: String(link.orderCode),
      createdAt: Date.now(),
      orderCode: link?.orderCode,
      qrCode: link?.qrCode,
      checkoutUrl: link?.checkoutUrl,
    };

    setPending(next);
    setStep('qr');

  };

  const handleRedirectToPayOS = (): void => {
    const url = pending?.checkoutUrl;
    if (!url || !isAbsoluteHttpUrl(url)) {
      onMessage('PayOS checkout URL is missing or invalid.', 'error');
      return;
    }
    // Intended browser behavior: top-level navigation so PayOS can manage the
    // redirect back to /payment/return with ?status=…&orderCode=… appended.
    window.location.assign(url);
  };

  const handleBack = (): void => {
    setStep('amount');
    setPending(null);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) closeDialog();
  };

  if (!isOpen) return null;

  const checkoutUrlValid = !!pending?.checkoutUrl && isAbsoluteHttpUrl(pending.checkoutUrl);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-topup-title"
      onClick={handleOverlayClick}
    >
      <div ref={dialogRef} className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {step === 'qr' ? (
              <button
                type="button"
                className={styles.backButton}
                onClick={handleBack}
                aria-label="Back to amount"
              >
                <ArrowLeft size={16} />
              </button>
            ) : null}
            <span className={styles.headerIcon} aria-hidden>
              <WalletIcon size={20} />
            </span>
            <h2 id="wallet-topup-title" className={styles.title}>
              {step === 'amount' ? 'Top Up Wallet' : 'Pay with PayOS'}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            aria-label="Close"
            onClick={closeDialog}
          >
            <X size={18} />
          </button>
        </header>

        {step === 'amount' ? (
          <div className={styles.body}>
            {/* Wallet unavailable — stop the user from attempting a payment. */}
            {!currentWalletId || currentWalletId <= 0 ? (
              <div className={styles.errorBanner}>
                <span>Your wallet information could not be loaded.</span>
                <button
                  type="button"
                  className={styles.retryButton}
                  onClick={closeDialog}
                >
                  Refresh and try again
                </button>
              </div>
            ) : null}

            <p className={styles.helperText}>
              Pick a quick amount or type a custom value. Funds are credited via
              PayOS. Min {formatVnd(MIN_AMOUNT_VND)} VND — max{' '}
              {formatVnd(MAX_AMOUNT_VND)} VND.
            </p>

            <label className={styles.label} htmlFor="topup-amount">
              Amount (VND)
            </label>
            <div className={styles.amountRow}>
              <input
                id="topup-amount"
                className={`${styles.amountInput} ${!isAmountValid && amountText.length > 0 ? styles.inputError : ''}`}
                inputMode="numeric"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="0"
                disabled={submitGuard}
              />
              <span className={styles.currency}>VND</span>
            </div>
            {!isAmountValid && amountText.length > 0 ? (
              <p className={styles.errorText}>
                Enter a value between {formatVnd(MIN_AMOUNT_VND)} and{' '}
                {formatVnd(MAX_AMOUNT_VND)} VND.
              </p>
            ) : null}

            <span className={styles.quickLabel}>Quick amounts</span>
            <div className={styles.quickGrid}>
              {QUICK_AMOUNTS_VND.map((amt) => {
                const selected = parsedAmount === amt;
                return (
                  <button
                    type="button"
                    key={amt}
                    className={`${styles.quickChip} ${selected ? styles.quickChipSelected : ''}`}
                    onClick={() => setAmountText(formatVnd(amt))}
                    disabled={submitGuard}
                  >
                    {formatVnd(amt)} VND
                  </button>
                );
              })}
            </div>

          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.qrPanel}>
              {/* Prefer the BE-supplied QR image when present. */}
              {pending?.qrCode ? (
                <img
                  src={pending.qrCode}
                  alt="PayOS QR code"
                  className={styles.qrImage}
                  width={200}
                  height={200}
                />
              ) : (
                <div className={styles.qrPlaceholder}>
                  <QrCode size={32} />
                </div>
              )}
              <span className={styles.qrBadge}>
                {pending?.qrCode ? 'PayOS QR' : 'QR unavailable'}
              </span>
            </div>

            {/* When the BE returns a checkoutUrl (the PayOS redirect URL
                for banking-app handoff), surface a redirect button. We
                avoid auto-redirecting so the user has time to read the
                summary, and so we never navigate to a missing/invalid
                URL by accident. */}
            {checkoutUrlValid ? (
              <button
                type="button"
                className={styles.checkoutLink}
                onClick={handleRedirectToPayOS}
                data-testid="payos-checkout-button"
              >
                <ExternalLink size={14} />
                Continue to PayOS
              </button>
            ) : null}

            <dl className={styles.summary}>
              <div className={styles.summaryRow}>
                <dt>Amount</dt>
                <dd>
                  <strong>
                    {pending ? formatVnd(pending.amountVnd) : '—'}
                  </strong>{' '}
                  VND
                </dd>
              </div>
              <div className={styles.summaryRow}>
                <dt>Reference</dt>
                <dd className={styles.monoCell}>
                  {pending?.reference ?? '—'}
                </dd>
              </div>
              {pending?.orderCode !== undefined ? (
                <div className={styles.summaryRow}>
                  <dt>Order Code</dt>
                  <dd className={styles.monoCell}>
                    {String(pending.orderCode)}
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className={styles.qrHint}>
              Scan the QR with a PayOS-supported banking app or continue to the
              PayOS checkout. Once you complete the payment, you'll return to
              this app and we'll confirm the result with the server before
              crediting your wallet.
            </p>
          </div>
        )}

        <footer className={styles.footer}>
          {step === 'amount' ? (
            <>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
                disabled={submitGuard || isCreatingLink}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmButton}
                onClick={() => void handleConfirmPay()}
                disabled={!isAmountValid || !currentWalletId || currentWalletId <= 0 || submitGuard || isCreatingLink}
                data-testid="confirm-pay-button"
              >
                {submitGuard || isCreatingLink
                  ? 'Creating PayOS link…'
                  : 'Confirm & Pay with PayOS'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleBack}
                disabled={submitGuard}
              >
                Back
              </button>
              {checkoutUrlValid ? (
                <button
                  type="button"
                  className={styles.confirmButton}
                  onClick={handleRedirectToPayOS}
                  data-testid="payos-checkout-button-footer"
                >
                  Continue to PayOS
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.confirmButton}
                  onClick={closeDialog}
                  data-testid="close-after-fallback"
                >
                  Close
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

export default WalletTopUpModal;

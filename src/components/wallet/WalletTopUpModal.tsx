import { useEffect, useMemo, useState } from 'react';
import { X, QrCode, Wallet as WalletIcon, Plus, ArrowLeft, ExternalLink } from 'lucide-react';
import { walletService } from '../../services/wallet.service';
import { useCreatePaymentLink } from '../../hooks/useCreatePaymentLink';
import { ROUTES } from '../../routes/paths';
import styles from './WalletTopUpModal.module.css';

// Static QR generator — no `react-qr-code` dependency required (the task
// spec allows either approach). The data payload embeds the amount and the
// locally-generated reference so any downstream reconciliation tooling can
// match the QR scan back to the intended top-up.
//
// This static QR is the FALLBACK when the BE is unavailable or doesn't
// return its own QR / checkout URL. The primary path is the live POST to
// `/api/Payment/create-link` (PayOS) via `useCreatePaymentLink`.
const QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/';

const QUICK_AMOUNTS_VND = [50_000, 100_000, 200_000, 500_000, 1_000_000];
const MIN_AMOUNT_VND = 10_000;
const MAX_AMOUNT_VND = 50_000_000;

interface WalletTopUpModalProps {
  isOpen: boolean;
  currentUserId?: number | null;
  // The BE's wallet id for the user. Optional — when missing we send 0 and
  // let the BE reject the request with a 400 (it owns the wallet->user
  // mapping). The parent (MainLayout) can look this up via walletService.
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
  // Locally-generated reference used as the fallback-QR data payload.
  reference: string;
  createdAt: number;
  // ── BE response fields (PaymentLink from src/types/domain.ts) ──
  // `orderCode` is the PayOS-side transaction reference returned by
  // `/api/Payment/create-link`.
  orderCode?: string | number;
  // `qrCode` is a base64 PNG / SVG returned by the BE. When present we
  // render it directly instead of the static QR fallback.
  qrCode?: string;
  // `checkoutUrl` is the PayOS redirect URL. When present we redirect the
  // user to it (no auto-redirect when missing — we keep the static-QR
  // fallback visible so the user can scan manually).
  checkoutUrl?: string;
}

const formatVnd = (n: number): string => n.toLocaleString('vi-VN');

// Locally-generated reference. Kept for the fallback QR path even when the
// BE returns its own orderCode. Uses the ARS-POS- prefix (PayOS Online
// Session) to distinguish from the legacy ARS-VNP- prefix.
const generateReference = (amount: number): string => {
  const stamp = Date.now().toString(36).toUpperCase();
  const amt = amount.toString(36).toUpperCase();
  return `ARS-POS-${stamp}-${amt}`;
};

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
  const [step, setStep] = useState<Step>('amount');
  const [amountText, setAmountText] = useState('100,000');
  const [pending, setPending] = useState<PendingTopUp | null>(null);
  const { create: createPaymentLink, isLoading: isCreatingLink, reset: resetLink } =
    useCreatePaymentLink();
  const [submitGuard, setSubmitGuard] = useState(false);

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

  // Builds the static QR image URL. Encoding the reference in the data lets
  // the future BE scan-callback match the QR to a payment record.
  const qrImageUrl = useMemo(() => {
    if (!pending) return '';
    const payload = JSON.stringify({
      ref: pending.reference,
      amount: pending.amountVnd,
      gateway: 'PayOS',
    });
    const data = encodeURIComponent(payload);
    return `${QR_API_BASE}?size=200x200&data=${data}`;
  }, [pending]);

  const handleConfirmPay = async (): Promise<void> => {
    if (!isAmountValid || parsedAmount === null) return;
    // Disable duplicate submission while the request is in flight.
    if (submitGuard || isCreatingLink) return;
    const amount = parsedAmount;
    const reference = generateReference(amount);

    // The return URL points at the existing /payment/return route. The
    // CheckoutReturn page will confirm with the BE before showing success.
    const returnPath = ROUTES.PAYMENT_RETURN;
    const baseUrl = window.location.origin;
    const returnUrl = `${baseUrl}${returnPath}?status=success&orderCode={orderCode}&ref=${encodeURIComponent(reference)}`;
    const cancelUrl = `${baseUrl}${returnPath}?status=CANCELLED&ref=${encodeURIComponent(reference)}`;

    setSubmitGuard(true);
    const beLink = await createPaymentLink({
      amount,
      description: `Wallet top-up ${formatVnd(amount)} VND`,
      userId: currentUserId ?? undefined,
      walletId: currentWalletId ?? 0,
      returnUrl,
      cancelUrl,
    });
    setSubmitGuard(false);

    const link = beLink ?? null;
    const usedFallback = link === null || !link.checkoutUrl;
    if (usedFallback) {
      // eslint-disable-next-line no-console
      console.warn(
        '[WalletTopUpModal] /api/Payment/create-link did not return a usable PayOS link; showing offline fallback.',
      );
    }

    const next: PendingTopUp = {
      amountVnd: amount,
      reference,
      createdAt: Date.now(),
      orderCode: link?.orderCode,
      qrCode: link?.qrCode,
      checkoutUrl: link?.checkoutUrl,
    };

    setPending(next);
    setStep('qr');

    if (usedFallback) {
      onMessage(
        'Could not reach the PayOS gateway. Showing an offline fallback QR for testing.',
        'error',
      );
    }
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

  const handleDevAutoFund = async (): Promise<void> => {
    if (!isAmountValid || parsedAmount === null) return;
    if (currentUserId === undefined || currentUserId === null) {
      onMessage('Cannot auto-fund: no signed-in user found.', 'error');
      return;
    }
    setSubmitGuard(true);
    try {
      const updated = await walletService.autoFund({
        userId: currentUserId,
        balance: parsedAmount,
      });
      onSuccess(updated.balance);
      onMessage(
        `DEV: Wallet funded ${formatVnd(parsedAmount)} VND (id #${updated.id}).`,
        'success',
      );
      onClose();
    } catch (err) {
      onMessage(
        err instanceof Error
          ? `DEV auto-fund failed: ${err.message}`
          : 'DEV auto-fund failed.',
        'error',
      );
    } finally {
      setSubmitGuard(false);
    }
  };

  const handleBack = (): void => {
    setStep('amount');
    setPending(null);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose();
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
      <div className={styles.modal}>
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
            type="button"
            className={styles.closeButton}
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        {step === 'amount' ? (
          <div className={styles.body}>
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

            {/* DEV-only quick auto-fund. Hidden in production builds because
                `import.meta.env.DEV` is statically false when building with
                `vite build`. The button directly POSTs `/api/Wallet` which
                bypasses PayOS — see docs/local-only/admin-suite-be-gap-report.md. */}
            {import.meta.env.DEV && currentUserId !== undefined && currentUserId !== null ? (
              <div className={styles.devBox}>
                <span className={styles.devLabel}>
                  DEV ONLY (hidden in production)
                </span>
                <p className={styles.devDescription}>
                  POST {`/api/Wallet`} directly. Use this for local UI testing
                  when PayOS is unavailable.
                </p>
                <button
                  type="button"
                  className={styles.devButton}
                  onClick={() => void handleDevAutoFund()}
                  disabled={!isAmountValid || submitGuard}
                  data-testid="dev-auto-fund-button"
                >
                  <Plus size={14} />
                  {submitGuard
                    ? 'Funding…'
                    : `Instant Auto-Fund (POST /api/Wallet — ${parsedAmount && isAmountValid ? formatVnd(parsedAmount) : '0'} VND)`}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={styles.body}>
            <div className={styles.qrPanel}>
              {/* Prefer the BE-supplied QR image when present
                  (`PaymentLink.qrCode`). Falls back to the static
                  qrserver.com generator so the UX still works without
                  BE — useful in local dev and the existing test suite. */}
              {pending?.qrCode ? (
                <img
                  src={pending.qrCode}
                  alt="PayOS QR code"
                  className={styles.qrImage}
                  width={200}
                  height={200}
                />
              ) : qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt="PayOS fallback QR code"
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
                {pending?.qrCode ? 'PayOS QR' : 'Fallback PayOS QR'}
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
                disabled={!isAmountValid || submitGuard || isCreatingLink}
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
                  onClick={onClose}
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
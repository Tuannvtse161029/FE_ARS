import { useEffect, useMemo, useRef, useState } from 'react';
import { X, QrCode, Wallet as WalletIcon, Plus, ArrowLeft, ExternalLink } from 'lucide-react';
import { walletService } from '../../services/wallet.service';
import { useCreatePaymentLink } from '../../hooks/useCreatePaymentLink';
import styles from './WalletTopUpModal.module.css';

// Static QR generator — no `react-qr-code` dependency required (the task
// spec allows either approach). The data payload embeds the amount and
// transaction reference so a future BE callback can match the QR scan.
//
// This static QR is the FALLBACK when the BE is unavailable or doesn't
// return its own QR. The primary path is the live POST to
// `/api/Payment/create-link` via `useCreatePaymentLink`.
const QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/';

const QUICK_AMOUNTS_VND = [50_000, 100_000, 200_000, 500_000, 1_000_000];
const MIN_AMOUNT_VND = 10_000;
const MAX_AMOUNT_VND = 50_000_000;
const SIMULATED_PAYMENT_DURATION_SEC = 30;

interface WalletTopUpModalProps {
  isOpen: boolean;
  currentUserId?: number | null;
  // The BE's wallet id for the user. Optional — when missing we send 0 and
  // let the BE reject the request with a 400 (it owns the wallet->user
  // mapping). The parent (MainLayout) can look this up via walletService.
  currentWalletId?: number | null;
  currentBalance: number | null;
  // Called whenever the wallet balance changes (mock or DEV auto-fund).
  onSuccess: (newBalance: number) => void;
  // Called for any toast-style message (success/error).
  onMessage: (text: string, type: 'success' | 'error') => void;
  onClose: () => void;
}

type Step = 'amount' | 'qr';

interface PendingTopUp {
  amountVnd: number;
  // Locally-generated reference used as the mock-QR data payload. Kept
  // even when the BE returns its own orderCode so the static QR fallback
  // path stays consistent across the two flows.
  reference: string;
  createdAt: number;
  // ── BE response fields (PaymentLink from src/types/domain.ts) ──
  // `orderCode` is the BE-side transaction reference returned by
  // `/api/Payment/create-link`. Surfaced in the QR step so the user (or
  // a future "Cancel payment" action) can match against it.
  orderCode?: string | number;
  // `qrCode` is a base64 PNG / SVG returned by the BE. When present we
  // render it directly instead of the static QR fallback.
  qrCode?: string;
  // `checkoutUrl` is the VNPay redirect URL. When present we surface a
  // "Pay with VNPay (opens in new tab)" link so the user has both
  // options: scan the QR with their banking app OR click through.
  checkoutUrl?: string;
}

const formatVnd = (n: number): string => n.toLocaleString('vi-VN');

const generateReference = (amount: number): string => {
  const stamp = Date.now().toString(36).toUpperCase();
  const amt = amount.toString(36).toUpperCase();
  return `ARS-VNP-${stamp}-${amt}`;
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
  const [step, setStep] = useState<Step>('amount');
  const [amountText, setAmountText] = useState('100,000');
  const [pending, setPending] = useState<PendingTopUp | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    SIMULATED_PAYMENT_DURATION_SEC,
  );
  const [autoFunding, setAutoFunding] = useState(false);
  const { create: createPaymentLink, isLoading: isCreatingLink } =
    useCreatePaymentLink();
  const timerRef = useRef<number | null>(null);

  // Reset internal state every time the modal opens. Closing keeps the state
  // until the next open so a partially-typed amount isn't lost on a tooltip.
  useEffect(() => {
    if (isOpen) {
      setStep('amount');
      setAmountText('100,000');
      setPending(null);
      setSecondsRemaining(SIMULATED_PAYMENT_DURATION_SEC);
      setAutoFunding(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

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
      gateway: 'VNPay_Mock',
    });
    const data = encodeURIComponent(payload);
    return `${QR_API_BASE}?size=200x200&data=${data}`;
  }, [pending]);

  const startCountdown = (): void => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    setSecondsRemaining(SIMULATED_PAYMENT_DURATION_SEC);
    timerRef.current = window.setInterval(() => {
      setSecondsRemaining((s) => {
        if (s <= 1) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleConfirmPay = async (): Promise<void> => {
    if (!isAmountValid || parsedAmount === null) return;
    const amount = parsedAmount;
    const reference = generateReference(amount);

    // Always POST /api/Payment/create-link first. The mock fallback (static
    // QR + countdown) only kicks in when the BE call fails or returns
    // nothing useful (e.g. older BEs that don't echo a QR / checkout URL).
    //
    // The request payload matches `PaymentCreateRequest` in
    // src/types/domain.ts: amount (required) + description/userId/walletId
    // /returnUrl/cancelUrl (optional). The BE owns the wallet->user mapping,
    // so we send `walletId ?? 0` and let it reject when invalid.
    //
    // `useCreatePaymentLink` swallows the error and returns `null` on
    // failure, surfacing it via its own `error` state — so we can't
    // detect the failure from the return value alone. We log to the
    // console for dev visibility and check the hook's error state after
    // the call resolves.
    const beLink = await createPaymentLink({
      amount,
      description: `Wallet top-up ${formatVnd(amount)} VND`,
      userId: currentUserId ?? undefined,
      walletId: currentWalletId ?? 0,
      returnUrl: `${window.location.origin}/wallet/topup?status=success&ref=${encodeURIComponent(reference)}`,
      cancelUrl: `${window.location.origin}/wallet/topup?status=cancelled&ref=${encodeURIComponent(reference)}`,
    });
    const usedFallback = beLink === null || beLink === undefined;
    if (usedFallback) {
      // eslint-disable-next-line no-console
      console.warn(
        '[WalletTopUpModal] /api/Payment/create-link did not return a usable link; using static QR fallback.',
      );
    }

    const next: PendingTopUp = {
      amountVnd: amount,
      reference,
      createdAt: Date.now(),
      orderCode: beLink?.orderCode,
      qrCode: beLink?.qrCode,
      checkoutUrl: beLink?.checkoutUrl,
    };

    setPending(next);
    setStep('qr');
    startCountdown();

    // Surface the soft warning when the BE didn't echo a usable link so
    // the user understands why the QR is the static mock.
    if (usedFallback) {
      onMessage(
        'Could not reach the payment gateway. Showing an offline mock QR for testing.',
        'error',
      );
    }
  };

  const handleSimulateSuccess = (): void => {
    if (!pending) return;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const baseBalance = currentBalance ?? 0;
    const newBalance = baseBalance + pending.amountVnd;
    onSuccess(newBalance);
    onMessage(
      `Top-up of ${formatVnd(pending.amountVnd)} VND succeeded (reference ${pending.reference}).`,
      'success',
    );
    onClose();
  };

  const handleDevAutoFund = async (): Promise<void> => {
    if (!isAmountValid || parsedAmount === null) return;
    if (currentUserId === undefined || currentUserId === null) {
      onMessage('Cannot auto-fund: no signed-in user found.', 'error');
      return;
    }
    setAutoFunding(true);
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
      setAutoFunding(false);
    }
  };

  const handleBack = (): void => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStep('amount');
    setPending(null);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  const mm = String(Math.floor(secondsRemaining / 60)).padStart(2, '0');
  const ss = String(secondsRemaining % 60).padStart(2, '0');

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
              {step === 'amount' ? 'Top Up Wallet' : 'Scan to Pay'}
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
              VNPay. Min {formatVnd(MIN_AMOUNT_VND)} VND — max{' '}
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
                  >
                    {formatVnd(amt)} VND
                  </button>
                );
              })}
            </div>

            {/* DEV-only quick auto-fund. Hidden in production builds because
                `import.meta.env.DEV` is statically false when building with
                `vite build`. The button directly POSTs `/api/Wallet` which
                bypasses VNPay — see docs/local-only/admin-suite-be-gap-report.md. */}
            {import.meta.env.DEV && currentUserId !== undefined && currentUserId !== null ? (
              <div className={styles.devBox}>
                <span className={styles.devLabel}>
                  DEV ONLY (hidden in production)
                </span>
                <p className={styles.devDescription}>
                  POST {`/api/Wallet`} directly. Use this for local UI testing
                  when VNPay is unavailable.
                </p>
                <button
                  type="button"
                  className={styles.devButton}
                  onClick={() => void handleDevAutoFund()}
                  disabled={!isAmountValid || autoFunding}
                  data-testid="dev-auto-fund-button"
                >
                  <Plus size={14} />
                  {autoFunding
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
                  alt="VNPay QR code"
                  className={styles.qrImage}
                  width={200}
                  height={200}
                />
              ) : qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt="VNPay mock QR code"
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
                {pending?.qrCode ? 'VNPay QR' : 'Mock VNPay QR'}
              </span>
            </div>

            {/* When the BE returns a checkoutUrl (the redirect URL for
                banking-app handoff), surface it as a click-through option
                alongside the QR. Many VNPay flows prefer the redirect URL
                over the QR. */}
            {pending?.checkoutUrl ? (
              <a
                href={pending.checkoutUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.checkoutLink}
                data-testid="vnpay-checkout-link"
              >
                <ExternalLink size={14} />
                Pay with VNPay (opens in new tab)
              </a>
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
              <div className={styles.summaryRow}>
                <dt>Expires in</dt>
                <dd>
                  <strong>{`${mm}:${ss}`}</strong>
                </dd>
              </div>
            </dl>

            <p className={styles.qrHint}>
              Open your banking app, scan the QR code above, and confirm the
              payment. The button below simulates a successful callback — wire
              it up to the real VNPay return URL once BE integration is live.
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
                disabled={isCreatingLink}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmButton}
                onClick={() => void handleConfirmPay()}
                disabled={!isAmountValid || isCreatingLink}
              >
                {isCreatingLink
                  ? 'Creating payment link…'
                  : 'Confirm & Pay with VNPay'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleBack}
              >
                Cancel Payment
              </button>
              <button
                type="button"
                className={styles.confirmButton}
                onClick={handleSimulateSuccess}
                data-testid="simulate-success-button"
              >
                Simulate Successful Payment
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

export default WalletTopUpModal;
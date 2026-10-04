/**
 * PaymentPolicyModal
 *
 * Forced read-and-accept gate before a user can start a PayOS checkout for
 * an annual subscription. The policy text is the live `payment_policy`
 * document from Firebase Firestore (admin-editable via the Admin Policies
 * page). The user must:
 *
 *   1. Open the modal to read the full text (a "Read full policy" link
 *      next to the pay button on the Subscription page triggers this).
 *   2. Tick the "I have read and accept..." checkbox themselves.
 *   3. Click "Confirm and proceed to payment" to actually launch PayOS.
 *
 * If the user closes the modal without confirming, no payment is started.
 * The modal does NOT persist acceptance to storage — every purchase
 * re-prompts so a stale or updated policy text always requires a fresh
 * read. Backend enforcement remains the authoritative gate; this modal
 * is defence-in-depth only (same as ReviewerPolicyModal).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { policyService } from '../../services/policy.service';
import type { PolicySnapshot } from '../../types/policy';
import styles from './PaymentPolicyModal.module.css';

export interface PaymentPolicyModalProps {
  isOpen: boolean;
  /** Plan name + price shown in the modal header so the user confirms
   *  the exact purchase they're about to authorise. */
  planLabel: string;
  /** Optional plan id for analytics / debug attribute hooks. */
  planId?: number | null;
  onCancel: () => void;
  /** Called only after the user has ticked the checkbox AND clicked
   *  "Confirm and proceed to payment". */
  onAccept: () => void;
}

export const PaymentPolicyModal = ({
  isOpen,
  planLabel,
  planId,
  onCancel,
  onAccept,
}: PaymentPolicyModalProps) => {
  const t = useT();
  const [snapshot, setSnapshot] = useState<PolicySnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const firstFocusRef = useRef<HTMLInputElement>(null);
  const lastFocusRef = useRef<HTMLButtonElement>(null);

  // Fetch the live policy text every time the modal opens so the user
  // always sees the most recent admin-edited version (not a cached copy
  // from when they first landed on the Subscription page).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setAccepted(false); // Reset checkbox on every open — see file header.
    void (async () => {
      try {
        const result = await policyService.getOne('payment_policy');
        if (!cancelled) setSnapshot(result);
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error
              ? caught.message
              : t(
                  'subscription.paymentPolicy.loadError',
                  'Could not load the payment policy. Please retry.',
                ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, t]);

  // Focus management + body scroll lock.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      firstFocusRef.current?.focus();
    }, 50);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  // Escape closes the modal — same as cancel.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleAccept = () => {
    if (!accepted) return; // Defense-in-depth — button is also disabled.
    onAccept();
  };

  const handleRetry = () => {
    setLoadError(null);
    setLoading(true);
    void policyService
      .getOne('payment_policy')
      .then((result) => setSnapshot(result))
      .catch((caught) =>
        setLoadError(
          caught instanceof Error
            ? caught.message
            : t(
                'subscription.paymentPolicy.loadError',
                'Could not load the payment policy. Please retry.',
              ),
        ),
      )
      .finally(() => setLoading(false));
  };

  const dialog = (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-policy-title"
      aria-describedby="payment-policy-body"
      data-testid="payment-policy-modal"
      data-plan-id={planId ?? ''}
      onClick={(event) => {
        // Click on backdrop = cancel. Clicks inside `.modal` are caught
        // by the `event.currentTarget` check below.
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className={styles.modal} role="document">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <ShieldCheck size={20} className={styles.headerIcon} aria-hidden="true" />
            <div>
              <h2 id="payment-policy-title" className={styles.title}>
                {t('subscription.paymentPolicy.title', 'Payment & No-Refund Policy')}
              </h2>
              <span className={styles.subtitle}>
                {t(
                  'subscription.paymentPolicy.forPlan',
                  'For plan: {plan}',
                ).replace('{plan}', planLabel)}
              </span>
            </div>
          </div>
          <button
            ref={lastFocusRef}
            type="button"
            className={styles.closeBtn}
            onClick={onCancel}
            aria-label={t('subscription.paymentPolicy.close', 'Close payment policy')}
            data-testid="payment-policy-close-btn"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          id="payment-policy-body"
          className={styles.body}
          data-testid="payment-policy-body"
        >
          <div className={styles.notice}>
            <AlertTriangle size={16} className={styles.noticeIcon} aria-hidden="true" />
            <p className={styles.noticeText}>
              {t(
                'subscription.paymentPolicy.mustRead',
                'Please read the full policy below before confirming your purchase. All annual subscription payments are final and non-refundable once processed.',
              )}
            </p>
          </div>

          {loading ? (
            <div className={styles.loading} role="status" data-testid="payment-policy-loading">
              {t('subscription.paymentPolicy.loading', 'Loading policy…')}
            </div>
          ) : loadError ? (
            <div className={styles.errorBlock} role="alert" data-testid="payment-policy-error">
              <p>{loadError}</p>
              <button
                type="button"
                className={styles.retryBtn}
                onClick={handleRetry}
                data-testid="payment-policy-retry"
              >
                {t('common.retry', 'Retry')}
              </button>
            </div>
          ) : snapshot ? (
            <div className={styles.policyContent}>
              <div className={styles.versionRow}>
                <span className={styles.versionBadge}>
                  {t('subscription.paymentPolicy.versionLabel', 'Policy version')}{' '}
                  v{snapshot.version}
                </span>
              </div>
              <pre className={styles.policyText} data-testid="payment-policy-text">
                {snapshot.content}
              </pre>
            </div>
          ) : null}
        </div>

        <div className={styles.footer}>
          <label className={styles.acceptRow}>
            <input
              ref={firstFocusRef}
              type="checkbox"
              className={styles.acceptCheckbox}
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              disabled={loading || Boolean(loadError) || !snapshot}
              data-testid="payment-policy-accept-checkbox"
              aria-required="true"
            />
            <span className={styles.acceptLabel}>
              {t(
                'subscription.paymentPolicy.acceptLabel',
                'I have read and accept the Payment & No-Refund Policy above. I understand that all annual subscription payments are final and non-refundable once processed.',
              )}
            </span>
          </label>

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onCancel}
              data-testid="payment-policy-cancel-btn"
            >
              {t('subscription.paymentPolicy.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={handleAccept}
              disabled={!accepted || loading || Boolean(loadError) || !snapshot}
              data-testid="payment-policy-confirm-btn"
            >
              {t('subscription.paymentPolicy.confirm', 'Confirm and proceed to payment')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return dialog;
  return createPortal(dialog, document.body);
};

export default PaymentPolicyModal;
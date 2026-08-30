import { useState } from 'react';
import { CreditCard, Info, QrCode, X } from 'lucide-react';
import styles from './TopUpModal.module.css';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (amount: number) => void;
  shortfallAmount: number;
  reviewerName: string;
}

const QUICK_AMOUNTS = [250_000, 500_000, 1_000_000] as const;

const formatVnd = (value: number): string =>
  value.toLocaleString('vi-VN');

/**
 * Researcher top-up modal — visual polish only.
 *
 * The localStorage business logic (and the `ars_wallet` + `wallet-update`
 * event contract) is preserved as-is. The backend payment integration is
 * the integration documented in BACKEND_REQUESTS.md; this file only
 * standardizes the surface to the ARS Research Constellation tokens.
 */
export const TopUpModal = ({
  isOpen,
  onClose,
  onSuccess,
  shortfallAmount,
  reviewerName,
}: TopUpModalProps) => {
  void onSuccess;
  const [depositAmount, setDepositAmount] = useState<number>(QUICK_AMOUNTS[0]);

  if (!isOpen) return null;

  const handleQuickSelect = (amount: number) => {
    setDepositAmount(amount);
  };

  const handleGenerateQr = () => {
    // PayOS confirmation is backend-owned. This surface stays available as a
    // clear explanation until a verified payment-link flow is connected.
    return;
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="top-up-modal-title">
      <div className={styles.modalCard}>
        <header className={styles.modalHeader}>
          <div className={styles.titleWrapper}>
            <span className={styles.walletIcon} aria-hidden>
              <CreditCard size={18} />
            </span>
            <h3 className={styles.modalTitle} id="top-up-modal-title">
              Top up wallet
            </h3>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close top-up dialog"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className={styles.shortfallBanner} role="status">
          <span className={styles.bannerText}>
            Shortfall for {reviewerName}
          </span>
          <span className={styles.shortfallAmount}>
            −{formatVnd(shortfallAmount)} VND
          </span>
        </div>

        <div className={styles.modalBody}>
          <span className={styles.inputLabel}>Deposit amount</span>
          <div className={styles.amountInputWrapper}>
            <span className={styles.amountValue}>{formatVnd(depositAmount)}</span>
            <span className={styles.currencyLabel}>VND</span>
          </div>

          <div className={styles.quickSelectGrid}>
            {QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                className={`${styles.quickSelectBtn} ${depositAmount === amount ? styles.quickSelectBtnActive : ''}`}
                onClick={() => handleQuickSelect(amount)}
                aria-pressed={depositAmount === amount}
              >
                {formatVnd(amount)} VND
              </button>
            ))}
          </div>

          <div className={styles.infoAlert} role="status">
            <span className={styles.infoIcon} aria-hidden>
              <Info size={14} />
            </span>
            <p className={styles.infoText}>
              PayOS top-up is unavailable in this build. No balance will be changed until the backend payment-link flow is available.
            </p>
          </div>
        </div>

        <footer className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.qrBtn}
            onClick={handleGenerateQr}
            disabled
            aria-describedby="top-up-unavailable"
          >
            <span className={styles.qrBtnIcon} aria-hidden>
              <QrCode size={14} />
            </span>
            Generate QR
          </button>
          <span id="top-up-unavailable" className={styles.srOnly}>
            Generate QR is unavailable until the backend payment-link flow is implemented.
          </span>
        </footer>
      </div>
    </div>
  );
};

export default TopUpModal;
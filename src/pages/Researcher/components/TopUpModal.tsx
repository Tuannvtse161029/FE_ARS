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
  const [depositAmount, setDepositAmount] = useState<number>(QUICK_AMOUNTS[0]);

  if (!isOpen) return null;

  const handleQuickSelect = (amount: number) => {
    setDepositAmount(amount);
  };

  const handleGenerateQr = () => {
    // Visual-only surface: the actual wallet increment + sync event
    // are still routed through localStorage until the BE payment
    // integration ships. See BACKEND_REQUESTS.md.
    const current = localStorage.getItem('ars_wallet');
    const currentVal = current ? parseInt(current, 10) : 500000;
    const newVal = currentVal + depositAmount;

    localStorage.setItem('ars_wallet', newVal.toString());
    window.dispatchEvent(new Event('wallet-update'));

    onSuccess(depositAmount);
    onClose();
  };

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="top-up-modal-title"
    >
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

          <div className={styles.infoAlert}>
            <span className={styles.infoIcon} aria-hidden>
              <Info size={14} />
            </span>
            <p className={styles.infoText}>
              Funds will be added via PayOS and automatically applied to your
              review request for {reviewerName}.
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
          >
            <span className={styles.qrBtnIcon} aria-hidden>
              <QrCode size={14} />
            </span>
            Generate QR
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TopUpModal;
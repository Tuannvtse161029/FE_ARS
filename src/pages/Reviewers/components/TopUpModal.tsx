import { useState } from 'react';
import styles from './TopUpModal.module.css';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (amount: number) => void;
  shortfallAmount: number;
  reviewerName: string;
}

export const TopUpModal = ({
  isOpen,
  onClose,
  onSuccess,
  shortfallAmount,
  reviewerName,
}: TopUpModalProps) => {
  const [depositAmount, setDepositAmount] = useState(250000);

  if (!isOpen) return null;

  const handleQuickSelect = (amount: number) => {
    setDepositAmount(amount);
  };

  const handleGenerateQr = () => {
    // Add to wallet in localStorage
    const current = localStorage.getItem('ars_wallet');
    const currentVal = current ? parseInt(current, 10) : 500000;
    const newVal = currentVal + depositAmount;
    
    localStorage.setItem('ars_wallet', newVal.toString());
    window.dispatchEvent(new Event('wallet-update')); // Trigger sync in MainLayout.tsx
    
    onSuccess(depositAmount);
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleWrapper}>
            <span className={styles.walletIcon}>💳</span>
            <h3 className={styles.modalTitle}>Top Up Wallet</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Shortfall warning banner */}
        <div className={styles.shortfallBanner}>
          <span className={styles.bannerText}>Shortfall for {reviewerName}</span>
          <span className={styles.shortfallAmount}>-{shortfallAmount.toLocaleString('vi-VN')} VND</span>
        </div>

        {/* Form Body */}
        <div className={styles.modalBody}>
          <label className={styles.inputLabel}>Deposit Amount</label>
          <div className={styles.amountInputWrapper}>
            <input
              type="text"
              className={styles.amountInput}
              value={depositAmount.toLocaleString('vi-VN')}
              readOnly
            />
            <span className={styles.currencyLabel}>VND</span>
          </div>

          {/* Quick Select Buttons */}
          <div className={styles.quickSelectGrid}>
            <button
              type="button"
              className={`${styles.quickSelectBtn} ${depositAmount === 250000 ? styles.quickSelectBtnActive : ''}`}
              onClick={() => handleQuickSelect(250000)}
            >
              250.000 VND
            </button>
            <button
              type="button"
              className={`${styles.quickSelectBtn} ${depositAmount === 500000 ? styles.quickSelectBtnActive : ''}`}
              onClick={() => handleQuickSelect(500000)}
            >
              500.000 VND
            </button>
            <button
              type="button"
              className={`${styles.quickSelectBtn} ${depositAmount === 1000000 ? styles.quickSelectBtnActive : ''}`}
              onClick={() => handleQuickSelect(1000000)}
            >
              1.000.000 VND
            </button>
          </div>

          {/* Info Alert Box */}
          <div className={styles.infoAlert}>
            <span className={styles.infoIcon}>ℹ</span>
            <p className={styles.infoText}>
              Funds will be added via VNPay and automatically applied to your review request for {reviewerName}.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.qrBtn} onClick={handleGenerateQr}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <rect x="7" y="7" width="3" height="3"></rect>
              <rect x="14" y="7" width="3" height="3"></rect>
              <rect x="7" y="14" width="3" height="3"></rect>
              <rect x="14" y="14" width="3" height="3"></rect>
            </svg>
            Generate QR
          </button>
        </div>
      </div>
    </div>
  );
};
export default TopUpModal;

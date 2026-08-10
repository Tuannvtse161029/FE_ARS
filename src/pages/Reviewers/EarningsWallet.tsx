import { useState, useEffect } from 'react';
import styles from './EarningsWallet.module.css';

export const EarningsWallet = () => {
  const [unlockedBalance, setUnlockedBalance] = useState(() => {
    const saved = localStorage.getItem('ars_reviewer_balance');
    return saved ? parseInt(saved, 10) : 4200000;
  });
  
  const pendingHolds = 500000;

  const [targetBank, setTargetBank] = useState(
    'Vietcombank (VCB) - Joint Stock Commercial Bank for Foreign Trade of Vietnam'
  );
  const [accountNumber, setAccountNumber] = useState('101299482103');
  const [withdrawalAmount, setWithdrawalAmount] = useState('2000000');
  const [narrative, setNarrative] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(withdrawalAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid withdrawal amount.');
      return;
    }
    if (amount > unlockedBalance) {
      alert('Insufficient unlocked balance.');
      return;
    }

    // Deduct from balance
    const newBalance = unlockedBalance - amount;
    setUnlockedBalance(newBalance);
    localStorage.setItem('ars_reviewer_balance', newBalance.toString());

    setSuccessAmount(amount);
    setIsSuccess(true);
  };

  return (
    <div className={styles.walletPage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Earnings Wallet &gt; <span className={styles.activeBreadcrumb}>Submit Withdrawal Request</span>
      </div>

      {/* Title */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Earnings & Withdrawals</h1>
      </div>

      {/* Section 1: Account Earnings Metrics */}
      <div className={styles.metricsCard}>
        <h3 className={styles.sectionTitle}>ACCOUNT EARNINGS METRICS</h3>
        
        <div className={styles.metricsGrid}>
          {/* Unlocked Balance */}
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Fully Unlocked Balance</span>
            <div className={styles.metricValRow}>
              <span className={styles.metricVal}>
                {unlockedBalance.toLocaleString('vi-VN')}
              </span>
              <span className={styles.metricCurrency}>VND</span>
            </div>
          </div>

          {/* Pending Holds */}
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel} style={{ color: '#d97706' }}>Pending Escrow Holds</span>
            <div className={styles.metricValRow}>
              <span className={styles.metricVal} style={{ color: '#d97706' }}>
                {pendingHolds.toLocaleString('vi-VN')}
              </span>
              <span className={styles.metricCurrency} style={{ color: '#d97706' }}>VND</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Withdrawal Form */}
      <div className={styles.formCard}>
        <h3 className={styles.sectionTitle}>CREATE REAL-WORLD BANKING WITHDRAWAL REQUEST</h3>

        <form onSubmit={handleSubmit} className={styles.form}>
          
          {/* Target Bank Dropdown */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>* Target Bank Selection</label>
            <select
              className={styles.formSelect}
              value={targetBank}
              onChange={(e) => setTargetBank(e.target.value)}
            >
              <option value="Vietcombank (VCB)">Vietcombank (VCB) - Joint Stock Commercial Bank for Foreign...</option>
              <option value="Techcombank (TCB)">Techcombank (TCB) - Vietnam Technological & Commercial Joint Stock Bank</option>
              <option value="BIDV">BIDV - Joint Stock Bank for Investment and Development of Vietnam</option>
              <option value="VietinBank">VietinBank - Vietnam Joint Stock Commercial Bank for Industry and Trade</option>
            </select>
          </div>

          {/* Account Number */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>* Beneficiary Bank Account Number</label>
            <input
              type="text"
              className={styles.formInput}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />
          </div>

          {/* Withdrawal Amount */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>* Exact Withdrawal Amount (VND)</label>
            <div className={styles.amountInputWrapper}>
              <input
                type="number"
                className={styles.amountInput}
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                min="50000"
                required
              />
              <span className={styles.amountSuffix}>VND</span>
            </div>
          </div>

          {/* Purpose narrative */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Request Narrative / Purpose</label>
            <textarea
              className={styles.formTextarea}
              placeholder="Add any additional narrative or instructions for the administrator..."
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={4}
            />
          </div>

          {/* Submit btn */}
          <button type="submit" className={styles.submitBtn}>
            Submit Cash-Out Request to Admin
          </button>
        </form>
      </div>

      {/* Success Modal */}
      {isSuccess && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModalCard}>
            <div className={styles.successIconCircle}>✓</div>
            <h3 className={styles.successModalTitle}>Withdrawal Request Submitted!</h3>
            <p className={styles.successModalText}>
              A cash-out request of <b>{successAmount.toLocaleString('vi-VN')} VND</b> has been sent to the administrator. The funds will be credited to account <b>{accountNumber}</b> at your selected bank.
            </p>
            <button className={styles.successBtn} onClick={() => setIsSuccess(false)}>
              Back to Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EarningsWallet;

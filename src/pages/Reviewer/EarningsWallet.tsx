import { useState } from 'react';
import {
  Shield,
  Building2,
  Check,
  X,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import styles from './EarningsWallet.module.css';

interface WithdrawalRequest {
  id: string;
  date: string;
  bank: string;
  account: string;
  amount: number;
  status: 'Accepted' | 'Rejected' | 'Pending';
}

export const EarningsWallet = () => {
  // Available balance state loaded from localStorage
  const [unlockedBalance, setUnlockedBalance] = useState(() => {
    const saved = localStorage.getItem('ars_reviewer_balance');
    return saved ? parseInt(saved, 10) : 4200000;
  });

  const pendingHolds = 500000;

  // Requests list
  const [requests, setRequests] = useState<WithdrawalRequest[]>([
    {
      id: '#WR-2026-001',
      date: '2026-06-15',
      bank: 'Vietcombank',
      account: '101299482103',
      amount: 1000000,
      status: 'Accepted',
    },
    {
      id: '#WR-2026-054',
      date: '2026-05-10',
      bank: 'BIDV',
      account: '31410001284',
      amount: 3000000,
      status: 'Rejected',
    },
    {
      id: '#WR-2026-092',
      date: '2026-07-20',
      bank: 'MB Bank',
      account: '9990128472',
      amount: 500000,
      status: 'Pending',
    },
  ]);

  // Modals visibility state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);

  // Form states inside modal
  const [targetBank, setTargetBank] = useState('Vietcombank (VCB)');
  const [accountNumber, setAccountNumber] = useState('101299482103');
  const [withdrawalAmount, setWithdrawalAmount] = useState('2000000');
  const [narrative, setNarrative] = useState('');

  const handleOpenRejectReason = (req: WithdrawalRequest) => {
    setSelectedRequest(req);
    setShowRejectModal(true);
  };

  const handleOpenCreateModal = () => {
    // Reset form
    setTargetBank('Vietcombank (VCB)');
    setAccountNumber('101299482103');
    setWithdrawalAmount('2000000');
    setNarrative('');
    setShowCreateModal(true);
  };

  const handleCreateWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(withdrawalAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (amount > unlockedBalance) {
      alert('Insufficient unlocked balance.');
      return;
    }

    // Deduct balances
    const newBalance = unlockedBalance - amount;
    setUnlockedBalance(newBalance);
    localStorage.setItem('ars_reviewer_balance', newBalance.toString());

    // Deduct Header wallet balance as well
    const headerWallet = localStorage.getItem('ars_wallet');
    const newHeaderWallet = (headerWallet ? parseInt(headerWallet, 10) : 1500000) - amount;
    localStorage.setItem('ars_wallet', newHeaderWallet.toString());

    // Dispatch event to sync wallet
    window.dispatchEvent(new Event('wallet-update'));

    // Add new pending request
    const newId = `#WR-2026-${Math.floor(100 + Math.random() * 900)}`;
    const today = new Date().toISOString().slice(0, 10);
    const newReq: WithdrawalRequest = {
      id: newId,
      date: today,
      bank: targetBank.split(' ')[0], // Extract initials
      account: accountNumber,
      amount: amount,
      status: 'Pending',
    };

    setRequests([newReq, ...requests]);
    setShowCreateModal(false);
  };

  const isAccountVerified = accountNumber === '101299482103';

  return (
    <div className={styles.walletPage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Earnings Wallet &gt; <span className={styles.activeBreadcrumb}>Withdrawal History</span>
      </div>

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Withdrawal Requests</h1>
          <p className={styles.pageSubtitle}>
            Manage your bank cash-out requests and track approval status.
          </p>
        </div>
        <button className={styles.createRequestBtn} onClick={handleOpenCreateModal}>
          ＋ Create New Request
        </button>
      </div>

      {/* Section 1: Earnings Metrics Card */}
      <div className={styles.metricsCard}>
        <h3 className={styles.sectionTitle}>ACCOUNT EARNINGS METRICS</h3>
        
        <div className={styles.metricsGrid}>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Fully Unlocked Balance</span>
            <div className={styles.metricValRow}>
              <span className={styles.metricVal}>
                {unlockedBalance.toLocaleString('vi-VN')}
              </span>
              <span className={styles.metricCurrency}>VND</span>
            </div>
          </div>

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

      {/* Section 2: Requests History Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>REQUEST ID</th>
                <th>SUBMISSION DATE</th>
                <th>BANK NAME</th>
                <th>ACCOUNT NUMBER</th>
                <th>AMOUNT (VND)</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td className={styles.requestIdText}>{req.id}</td>
                  <td>{req.date}</td>
                  <td className={styles.bankNameText}>{req.bank}</td>
                  <td>{req.account}</td>
                  <td className={styles.amountText}>{req.amount.toLocaleString('vi-VN')} VND</td>
                  <td>
                    {req.status === 'Accepted' && (
                      <span className={styles.statusAccepted}>
                        <Check size={12} strokeWidth={3} style={{ verticalAlign: 'middle' }} /> Accepted
                      </span>
                    )}
                    {req.status === 'Rejected' && (
                      <span className={styles.statusRejected}>
                        <X size={12} strokeWidth={3} style={{ verticalAlign: 'middle' }} /> Rejected
                      </span>
                    )}
                    {req.status === 'Pending' && (
                      <span className={styles.statusPending}>● Pending</span>
                    )}
                  </td>
                  <td>
                    {req.status === 'Rejected' ? (
                      <button
                        className={styles.viewReasonBtn}
                        onClick={() => handleOpenRejectReason(req)}
                      >
                        <Shield size={13} style={{ verticalAlign: 'middle' }} /> View Reason
                      </button>
                    ) : (
                      <button
                        className={styles.viewBtn}
                        onClick={() => alert(`Details for request ${req.id}`)}
                      >
                        <Eye size={13} style={{ verticalAlign: 'middle' }} /> View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FRAME 23: REQUEST REJECTION NOTICE MODAL */}
      {showRejectModal && selectedRequest && (
        <div className={styles.modalOverlay}>
          <div className={styles.rejectModalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.warningShieldIcon}>
                  <AlertTriangle size={24} color="#e53e3e" />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Request Rejection Notice</h3>
                  <span className={styles.modalSubtitle}>Admin review decision for {selectedRequest.id}</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowRejectModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Request Summary table */}
            <div className={styles.rejectSummaryTable}>
              <div className={styles.summaryCol}>
                <span className={styles.summaryLabel}>BANK</span>
                <span className={styles.summaryVal}>{selectedRequest.bank}</span>
              </div>
              <div className={styles.summaryCol}>
                <span className={styles.summaryLabel}>ACCOUNT</span>
                <span className={styles.summaryVal}>{selectedRequest.account}</span>
              </div>
              <div className={styles.summaryCol}>
                <span className={styles.summaryLabel}>AMOUNT</span>
                <span className={styles.summaryVal}>{selectedRequest.amount.toLocaleString('vi-VN')} VND</span>
              </div>
              <div className={styles.summaryCol}>
                <span className={styles.summaryLabel}>SUBMITTED</span>
                <span className={styles.summaryVal}>{selectedRequest.date}</span>
              </div>
              <span className={styles.statusRejectedPill}>● Rejected</span>
            </div>

            {/* Admin rejection note content */}
            <div className={styles.rejectionNoteBox}>
              <div className={styles.noteLabel}>ADMIN REJECTION NOTE</div>
              <p className={styles.noteContent}>
                Dear Reviewer,<br /><br />
                After careful review, your withdrawal request <b>{selectedRequest.id}</b> submitted on <b>{selectedRequest.date}</b> has been rejected. Please review the findings below before resubmitting.<br /><br />
                ---------------------------------------------------------------------<br />
                <b>REASON &mdash; BENEFICIARY ACCOUNT VERIFICATION FAILURE</b><br /><br />
                The beneficiary account number {selectedRequest.account} at {selectedRequest.bank} could not be validated through our banking partner verification service at the time of processing. The lookup returned a status of "Account Inactive or Non-Existent." This may indicate the account has been closed, the number was entered incorrectly, or the account belongs to a different branch routing code.<br /><br />
                If you believe this rejection is in error or require further clarification, please contact the platform support team at <u>support@ars-platform.edu</u> and quote reference code <b>REJ-054-2026</b>.<br /><br />
                Regards,<br />
                ARS Platform Administration
              </p>
              <div className={styles.reviewerSignature}>
                Reviewed by <b>Platform Admin</b> · {selectedRequest.date}
              </div>
            </div>

            <button className={styles.modalCloseBtn} onClick={() => setShowRejectModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* FRAME 24: SUBMIT WITHDRAWAL REQUEST MODAL FORM */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.createModalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.withdrawalIcon}>
                  <Building2 size={24} color="#2563eb" />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Submit Withdrawal Request</h3>
                  <span className={styles.modalSubtitle}>Transfer unlocked earnings to your bank account</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Internal Metric Bar */}
            <div className={styles.modalMetricsBar}>
              <div className={styles.metricItem}>
                <span className={styles.metricBarLabel}>Fully Unlocked Balance</span>
                <span className={styles.metricBarVal}>{unlockedBalance.toLocaleString('vi-VN')} VND</span>
              </div>
              <div className={styles.metricItem} style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '20px' }}>
                <span className={styles.metricBarLabel} style={{ color: '#d97706' }}>Pending Escrow Holds</span>
                <span className={styles.metricBarVal} style={{ color: '#d97706' }}>{pendingHolds.toLocaleString('vi-VN')} VND</span>
              </div>
            </div>

            <form onSubmit={handleCreateWithdrawal} className={styles.modalForm}>
              {/* Target Bank select */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Target Bank Selection</label>
                <select
                  className={styles.formSelect}
                  value={targetBank}
                  onChange={(e) => setTargetBank(e.target.value)}
                >
                  <option value="Vietcombank (VCB)">Vietcombank (VCB) - Joint Stock Commercial Bank for Foreign Trade of Vietnam</option>
                  <option value="BIDV">BIDV - Joint Stock Bank for Investment and Development of Vietnam</option>
                  <option value="Techcombank (TCB)">Techcombank (TCB) - Vietnam Technological & Joint Stock Bank</option>
                </select>
              </div>

              {/* Beneficiary bank account */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Beneficiary Bank Account Number</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                />
                {/* Account holder verification card */}
                {isAccountVerified && (
                  <div className={styles.verificationCard}>
                    <span className={styles.verifyIcon}><Check size={16} color="#099268" /></span>
                    <div className={styles.verifyMeta}>
                      <span className={styles.verifyTitle}>ACCOUNT HOLDER VERIFIED</span>
                      <span className={styles.verifyName}>NGUYEN VAN A</span>
                    </div>
                    <span className={styles.confirmedBadge}><Check size={11} strokeWidth={3} style={{ verticalAlign: 'middle' }} /> Confirmed</span>
                  </div>
                )}
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
                    max={unlockedBalance}
                    required
                  />
                  <span className={styles.amountSuffix}>VND</span>
                </div>
                <span className={styles.availableText}>Available: {unlockedBalance.toLocaleString('vi-VN')} VND</span>
              </div>

              {/* Narrative */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Request Narrative / Purpose</label>
                <textarea
                  className={styles.formTextarea}
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder="Describe the purpose of this withdrawal request..."
                  rows={3}
                />
              </div>

              {/* Footer buttons */}
              <div className={styles.modalFormFooter}>
                <button 
                  type="button" 
                  className={styles.modalCancelBtn}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmitBtn}>
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EarningsWallet;

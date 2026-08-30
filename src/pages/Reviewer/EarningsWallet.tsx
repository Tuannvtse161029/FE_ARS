import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  Building2,
  Check,
  X,
  Eye,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import styles from './EarningsWallet.module.css';
import { withdrawalService, WithdrawalRequest } from '../../services/withdrawal.service';
import { WithdrawalSuccessModal } from './components/WithdrawalSuccessModal';
import { useAuthStore } from '../../store/authSlice';
import { useWallet } from '../../hooks/useWallet';
import { AppConfig } from '../../config/app';
import { FieldError } from '../../components/FieldError';
import {
  validatePositiveInteger,
  validateVietnameseName,
} from '../../utils/validationRules';

// ── Centralized withdrawal feature gate (temporary) ─────────────────────────
// While `AppConfig.features.enableWithdrawals` is `false`, the page renders
// an informational notice in place of the table, form, modal triggers, and
// API calls. All underlying hooks / services / modal components are
// preserved verbatim and resume the moment the flag is re-enabled.
// See src/config/app.ts for the rationale and full set of gated surfaces.
const WITHDRAWAL_DISABLED_MESSAGE =
  'Cash-out withdrawal requests are temporarily unavailable while the requirements are being revised. Your wallet balance, top-up, and transaction history are unaffected.';

export const EarningsWallet = () => {
  // Single source of truth: respect the centralized feature flag. Any stale
  // page render goes through this gate before any API call or interactive
  // control can fire.
  const withdrawalsEnabled = AppConfig.features.enableWithdrawals === true;

  const currentUserId = useAuthStore((s) => s.user?.id);
  const { walletId, balance: walletBalance, isLoading: isWalletLoading, error: walletError } = useWallet(currentUserId);

  // Defense-in-depth guard for direct navigation. While the flag is off, the
  // page renders ONLY an informational notice — no API calls, no buttons, no
  // forms, no modals, no tables. The sidebar entry is also hidden (see
  // MainLayout). Hooks above MUST run before this conditional to satisfy the
  // rules of hooks, but no withdrawal UI/data fetch is attempted.
  //
  // The shell (breadcrumbs, metrics card) remains visible so a Reviewer who
  // hits /earnings-wallet via a stale bookmark still lands on a coherent
  // page rather than a blank redirect.

  // Wallet balances are displayed only when the backend has confirmed them.
  const unlockedBalance = walletBalance ?? 0;

  // Requests list — loaded from API
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals visibility state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successRequestId, setSuccessRequestId] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);

  // Form states inside modal
  const [targetBank, setTargetBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [narrative, setNarrative] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline field errors
  const [targetBankError, setTargetBankError] = useState<string | null>(null);
  const [accountNameError, setAccountNameError] = useState<string | null>(null);
  const [accountNumberError, setAccountNumberError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    // Wait for authenticated user and wallet data before fetching
    if (!currentUserId || !walletId) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await withdrawalService.getAll();
      // Filter to current user's requests (backend should do this, but defend here)
      const userRequests = data.filter(req => req.userId === currentUserId);
      setRequests(userRequests);
    } catch (err) {
      setError('Failed to load withdrawal requests. Please try again.');
      if (import.meta.env?.DEV) {
        // Log sanitized error details in development
        console.error('[EarningsWallet] Withdrawal request load failed:', {
          status: (err as any)?.response?.status,
          message: (err as Error)?.message,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [currentUserId, walletId]);

  useEffect(() => {
    if (!withdrawalsEnabled) return;
    void fetchRequests();
  }, [fetchRequests, withdrawalsEnabled]);

  // Newest first by createdAt.
  const sortedRequests = useMemo(
    () =>
      [...requests].sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      ),
    [requests],
  );

  const handleOpenRejectReason = (req: WithdrawalRequest) => {
    if (!withdrawalsEnabled) return;
    setSelectedRequest(req);
    setShowRejectModal(true);
  };

  const handleOpenCreateModal = () => {
    if (!withdrawalsEnabled) return;
    setTargetBank('');
    setAccountNumber('');
    setAccountName('');
    setWithdrawalAmount('');
    setNarrative('');
    setTargetBankError(null);
    setAccountNameError(null);
    setAccountNumberError(null);
    setAmountError(null);
    setShowCreateModal(true);
  };

  const handleCreateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Inline validation ───────────────────────────────────────
    const bankErr = targetBank ? null : 'Please select a target bank.';
    const trimmedName = accountName.trim();
    const nameErr = validateVietnameseName(trimmedName) ?? (trimmedName ? null : 'Account holder name is required.');
    const trimmedAcct = accountNumber.trim();
    const acctErr = trimmedAcct ? null : 'Account number is required.';
    const amountValidation = validatePositiveInteger(withdrawalAmount);
    let amtErr: string | null = amountValidation ?? null;
    if (!amtErr) {
      const amountNum = parseInt(withdrawalAmount, 10);
      if (amountNum > unlockedBalance) amtErr = 'Insufficient unlocked balance.';
    }
    setTargetBankError(bankErr);
    setAccountNameError(nameErr);
    setAccountNumberError(acctErr);
    setAmountError(amtErr);
    if (bankErr || nameErr || acctErr || amtErr) return;

    const amount = parseInt(withdrawalAmount, 10);

    setSubmitting(true);
    try {
      const result = await withdrawalService.create({
        userId: currentUserId ?? undefined,
        walletId: walletId ?? undefined,
        bankName: targetBank,
        accountNumber,
        accountName,
        amount,
        note: narrative,
      });

      const returnedId = result.id ?? result.withdrawalRequestId;
      if (typeof returnedId !== 'number' || returnedId <= 0) {
        throw new Error('Withdrawal request was created without an identifier.');
      }
      const displayId = `#WR-${String(returnedId).padStart(6, '0')}`;
      setSuccessRequestId(displayId);

      await fetchRequests();
      setShowCreateModal(false);
      setShowSuccessModal(true);
    } catch (err) {
      alert('Failed to submit withdrawal request. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };


  const formatId = (req: WithdrawalRequest) => {
    const raw = req.id ?? req.withdrawalRequestId;
    return raw ? `#WR-${String(raw).padStart(6, '0')}` : '#WR-——';
  };

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
        <div className={styles.headerActions}>
          {withdrawalsEnabled && (
            <>
              <button
                className={styles.refreshBtn}
                onClick={fetchRequests}
                disabled={loading}
                title="Refresh"
              >
                <RefreshCw size={15} className={loading ? styles.spinning : ''} />
              </button>
              <button className={styles.createRequestBtn} onClick={handleOpenCreateModal}>
                ＋ Create New Request
              </button>
            </>
          )}
        </div>
      </div>

      {/* Withdrawal disabled notice — only shown while the centralized feature
          flag is off. Replaces the Create button, the table, the View Reason
          actions, and all modal triggers so a stale direct-page render cannot
          reach any withdrawal API call. */}
      {!withdrawalsEnabled && (
        <div
          className={styles.tableCard}
          data-testid="withdrawal-disabled-notice"
          role="status"
        >
          <div className={styles.emptyState}>
            <AlertTriangle size={32} color="#d97706" />
            <span>{WITHDRAWAL_DISABLED_MESSAGE}</span>
          </div>
        </div>
      )}

      {/* Section 1: Earnings Metrics Card */}
      <div className={styles.metricsCard}>
        <h3 className={styles.sectionTitle}>ACCOUNT EARNINGS METRICS</h3>

        <div className={styles.metricsGrid}>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Fully Unlocked Balance</span>
            <div className={styles.metricValRow}>
              <span className={styles.metricVal}>
                {isWalletLoading
                  ? 'Loading…'
                  : walletError || walletBalance === null
                    ? 'Unavailable'
                    : unlockedBalance.toLocaleString('vi-VN')}
              </span>
              {!walletError && walletBalance !== null ? (
                <span className={styles.metricCurrency}>VND</span>
              ) : null}
            </div>
          </div>

          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Pending Holds</span>
            <div className={styles.metricValRow}>
              <span className={styles.metricVal}>Unavailable</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Requests History Table — only shown while withdrawals are
          enabled. Disabled-state notice above replaces all interactive
          surfaces (table rows, View Reason buttons, modals). */}
      {withdrawalsEnabled && (
      <div className={styles.tableCard}>
        {loading && requests.length === 0 ? (
          <div className={styles.loadingState}>
            <RefreshCw size={20} className={styles.spinning} />
            <span>Loading withdrawal requests...</span>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <AlertTriangle size={20} color="#ef4444" />
            <span>{error}</span>
            <button className={styles.retryBtn} onClick={fetchRequests}>
              Retry
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className={styles.emptyState}>
            <Building2 size={32} color="#94a3b8" />
            <span>No withdrawal requests found.</span>
            <button className={styles.createRequestBtn} onClick={handleOpenCreateModal}>
              Create your first request
            </button>
          </div>
        ) : (
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
                {sortedRequests.map((req) => (
                  <tr key={req.id ?? req.withdrawalRequestId}>
                    <td className={styles.requestIdText}>{formatId(req)}</td>
                    <td>{req.createdAt ? req.createdAt.slice(0, 10) : '——'}</td>
                    <td className={styles.bankNameText}>{req.bankName ?? '——'}</td>
                    <td>{req.accountNumber ?? '——'}</td>
                    <td className={styles.amountText}>
                      {req.amount != null ? `${req.amount.toLocaleString('vi-VN')} VND` : '——'}
                    </td>
                    <td>
                      {req.status === 'Approved' && (
                        <span className={styles.statusAccepted}>
                          <Check size={12} strokeWidth={3} style={{ verticalAlign: 'middle' }} /> Approved
                        </span>
                      )}
                      {req.status === 'Rejected' && (
                        <span className={styles.statusRejected}>
                          <X size={12} strokeWidth={3} style={{ verticalAlign: 'middle' }} /> Rejected
                        </span>
                      )}
                      {(req.status === 'Pending' || !req.status) && (
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
                          onClick={() => alert(`Details for request ${formatId(req)}`)}
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
        )}
      </div>
      )}

      {/* Modal surfaces are co-gated with the table. While the feature flag is
          off, none of the modal triggers exist (the Create/View Reason buttons
          are hidden above), but we still short-circuit here so a programmatic
          open cannot leak through. */}
      {withdrawalsEnabled && showRejectModal && selectedRequest && (
        <div className={styles.modalOverlay}>
          <div className={styles.rejectModalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.warningShieldIcon}>
                  <AlertTriangle size={24} color="#e53e3e" />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Request Rejection Notice</h3>
                  <span className={styles.modalSubtitle}>
                    Admin review decision for {formatId(selectedRequest)}
                  </span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowRejectModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.rejectSummaryTable}>
              <div className={styles.summaryCol}>
                <span className={styles.summaryLabel}>BANK</span>
                <span className={styles.summaryVal}>{selectedRequest.bankName ?? '——'}</span>
              </div>
              <div className={styles.summaryCol}>
                <span className={styles.summaryLabel}>ACCOUNT</span>
                <span className={styles.summaryVal}>{selectedRequest.accountNumber ?? '——'}</span>
              </div>
              <div className={styles.summaryCol}>
                <span className={styles.summaryLabel}>AMOUNT</span>
                <span className={styles.summaryVal}>
                  {selectedRequest.amount != null
                    ? `${selectedRequest.amount.toLocaleString('vi-VN')} VND`
                    : '——'}
                </span>
              </div>
              <div className={styles.summaryCol}>
                <span className={styles.summaryLabel}>SUBMITTED</span>
                <span className={styles.summaryVal}>
                  {selectedRequest.createdAt ? selectedRequest.createdAt.slice(0, 10) : '——'}
                </span>
              </div>
              <span className={styles.statusRejectedPill}>● Rejected</span>
            </div>

            <div className={styles.rejectionNoteBox}>
              <div className={styles.noteLabel}>ADMIN REJECTION NOTE</div>
              <p className={styles.noteContent}>
                {selectedRequest.rejectionReason ? (
                  selectedRequest.rejectionReason
                ) : (
                  <>
                    Dear Reviewer,<br /><br />
                    After careful review, your withdrawal request{' '}
                    <b>{formatId(selectedRequest)}</b> has been rejected. Please review the findings
                    below before resubmitting.<br /><br />
                    If you believe this rejection is in error, please contact the platform support team
                    at <u>support@ars-platform.edu</u>.<br /><br />
                    Regards,<br />
                    ARS Platform Administration
                  </>
                )}
              </p>
              <div className={styles.reviewerSignature}>
                Reviewed by <b>Platform Admin</b>
              </div>
            </div>

            <button className={styles.modalCloseBtn} onClick={() => setShowRejectModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* FRAME 24: SUBMIT WITHDRAWAL REQUEST MODAL FORM */}
      {withdrawalsEnabled && showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.createModalCard}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.withdrawalIcon}>
                  <Building2 size={24} color="#2563eb" />
                </span>
                <div>
                  <h3 className={styles.modalTitle}>Submit Withdrawal Request</h3>
                  <span className={styles.modalSubtitle}>
                    Transfer unlocked earnings to your bank account
                  </span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalMetricsBar}>
              <div className={styles.metricItem}>
                <span className={styles.metricBarLabel}>Fully Unlocked Balance</span>
                <span className={styles.metricBarVal}>
                  {unlockedBalance.toLocaleString('vi-VN')} VND
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricBarLabel}>Pending Holds</span>
                <span className={styles.metricBarVal}>Unavailable</span>
              </div>
            </div>

            <form onSubmit={handleCreateWithdrawal} className={styles.modalForm}>
              {/* Target Bank select */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="wd-bank">* Target Bank Selection</label>
                <select
                  id="wd-bank"
                  className={styles.formSelect}
                  value={targetBank}
                  onChange={(e) => {
                    setTargetBank(e.target.value);
                    if (targetBankError) setTargetBankError(null);
                  }}
                  aria-invalid={Boolean(targetBankError)}
                  aria-describedby={targetBankError ? 'wd-bank-error' : undefined}
                >
                  <option value="" disabled>Select your bank</option>
                  <option value="Vietcombank (VCB)">Vietcombank (VCB) - Joint Stock Commercial Bank for Foreign Trade of Vietnam</option>
                  <option value="BIDV">BIDV - Joint Stock Bank for Investment and Development of Vietnam</option>
                  <option value="Techcombank (TCB)">Techcombank (TCB) - Vietnam Technological &amp; Joint Stock Bank</option>
                </select>
                <FieldError id="wd-bank-error" message={targetBankError} testId="wd-bank-error" />
              </div>

              {/* Account Name */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="wd-account-name">* Account Holder Name</label>
                <input
                  id="wd-account-name"
                  type="text"
                  className={`${styles.formInput} ${accountNameError ? styles.formInputError : ''}`}
                  value={accountName}
                  onChange={(e) => {
                    setAccountName(e.target.value);
                    if (accountNameError) setAccountNameError(null);
                  }}
                  placeholder="Enter account holder name"
                  aria-invalid={Boolean(accountNameError)}
                  aria-describedby={accountNameError ? 'wd-account-name-error' : undefined}
                />
                <FieldError id="wd-account-name-error" message={accountNameError} testId="wd-account-name-error" />
              </div>

              {/* Beneficiary bank account */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="wd-account-number">* Beneficiary Bank Account Number</label>
                <input
                  id="wd-account-number"
                  type="text"
                  className={`${styles.formInput} ${accountNumberError ? styles.formInputError : ''}`}
                  value={accountNumber}
                  onChange={(e) => {
                    setAccountNumber(e.target.value);
                    if (accountNumberError) setAccountNumberError(null);
                  }}
                  placeholder="Enter your bank account number"
                  aria-invalid={Boolean(accountNumberError)}
                  aria-describedby={accountNumberError ? 'wd-account-number-error' : undefined}
                />
                <FieldError id="wd-account-number-error" message={accountNumberError} testId="wd-account-number-error" />
              </div>

              {/* Withdrawal Amount */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="wd-amount">* Exact Withdrawal Amount (VND)</label>
                <div className={styles.amountInputWrapper}>
                  <input
                    id="wd-amount"
                    type="number"
                    className={`${styles.amountInput} ${amountError ? styles.formInputError : ''}`}
                    value={withdrawalAmount}
                    onChange={(e) => {
                      setWithdrawalAmount(e.target.value);
                      if (amountError) setAmountError(null);
                    }}
                    max={unlockedBalance}
                    min={1}
                    aria-invalid={Boolean(amountError)}
                    aria-describedby={amountError ? 'wd-amount-error' : undefined}
                  />
                  <span className={styles.amountSuffix}>VND</span>
                </div>
                <span className={styles.availableText}>
                  Available: {unlockedBalance.toLocaleString('vi-VN')} VND
                </span>
                <FieldError id="wd-amount-error" message={amountError} testId="wd-amount-error" />
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
                  disabled={submitting}
                >
                  Cancel
                </button>
                  <button
                    type="submit"
                    className={styles.modalSubmitBtn}
                    disabled={submitting || !walletId}
                  >
                  {submitting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL — gated by the centralized withdrawal flag. Even
          though the create flow is impossible while disabled, this short-
          circuits a stale `successRequestId` state from any path that might
          try to surface it. */}
      {withdrawalsEnabled && (
        <WithdrawalSuccessModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          requestId={successRequestId}
        />
      )}
    </div>
  );
};

export default EarningsWallet;

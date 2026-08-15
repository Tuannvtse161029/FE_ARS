import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Building2,
  Check,
  X,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { withdrawalService, WithdrawalRequest } from '../../services/withdrawal.service';
import styles from './AdminWithdrawalRequests.module.css';

type StatusFilter = 'All' | 'Pending' | 'Approved' | 'Rejected';

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const formatAmount = (amount?: number | null) =>
  amount != null ? `${amount.toLocaleString('vi-VN')} VND` : '—';

const statusClass = (status?: string | null) => {
  switch (status) {
    case 'Approved': return styles.statusApproved;
    case 'Rejected': return styles.statusRejected;
    default: return styles.statusPending;
  }
};

export const AdminWithdrawalRequests = () => {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  // Reject modal
  const [rejectModal, setRejectModal] = useState<WithdrawalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await withdrawalService.getAll();
      setRequests(data);
    } catch {
      setError('Failed to load withdrawal requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const handleApprove = async (req: WithdrawalRequest) => {
    const id = req.id ?? req.withdrawalRequestId;
    if (!id) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      await withdrawalService.updateStatus(id, { status: 'Approved', reviewerId: req.userId ?? undefined });
      window.dispatchEvent(new CustomEvent('withdrawal-update'));
      void load();
    } catch {
      setActionError('Failed to approve. Please try again.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const openRejectModal = (req: WithdrawalRequest) => {
    setRejectModal(req);
    setRejectReason('');
    setActionError(null);
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;
    const id = rejectModal.id ?? rejectModal.withdrawalRequestId;
    if (!id) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      await withdrawalService.updateStatus(id, {
        status: 'Rejected',
        reviewerId: rejectModal.userId ?? undefined,
        rejectionReason: rejectReason.trim(),
      });
      window.dispatchEvent(new CustomEvent('withdrawal-update'));
      void load();
      setRejectModal(null);
    } catch {
      setActionError('Failed to reject. Please try again.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const filtered = requests.filter((r) => {
    if (statusFilter === 'All') return true;
    return r.status === statusFilter;
  });

  const counts = {
    All: requests.length,
    Pending: requests.filter((r) => r.status === 'Pending').length,
    Approved: requests.filter((r) => r.status === 'Approved').length,
    Rejected: requests.filter((r) => r.status === 'Rejected').length,
  };

  return (
    <div className={styles.page}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Admin &gt; <span className={styles.activeBreadcrumb}>Withdrawal Requests</span>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Withdrawal Requests</h1>
          <p className={styles.pageSubtitle}>Review and action user cash-out requests.</p>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing || loading}
          title="Refresh"
        >
          <RefreshCw size={14} className={refreshing ? styles.spinning : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Status filter tabs */}
      <div className={styles.filterTabs}>
        {(['All', 'Pending', 'Approved', 'Rejected'] as StatusFilter[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.filterTab} ${statusFilter === tab ? styles.filterTabActive : ''}`}
            onClick={() => setStatusFilter(tab)}
          >
            {tab}
            {counts[tab] > 0 && (
              <span className={styles.filterCount}>{counts[tab]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Main table card */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>
            <RefreshCw size={20} className={styles.spinning} />
            <span>Loading requests…</span>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <AlertTriangle size={20} color="#ef4444" />
            <span>{error}</span>
            <button className={styles.retryBtn} onClick={() => void load()}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <Building2 size={32} color="#94a3b8" />
            <span>No {statusFilter === 'All' ? '' : statusFilter.toLowerCase()} requests found.</span>
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>REQUEST ID</th>
                  <th>SUBMITTED</th>
                  <th>USER</th>
                  <th>BANK</th>
                  <th>ACCOUNT</th>
                  <th>ACCOUNT NAME</th>
                  <th>AMOUNT (VND)</th>
                  <th>NARRATIVE</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => {
                  const rowId = req.id ?? req.withdrawalRequestId;
                  return (
                    <>
                      <tr key={rowId}>
                        <td className={styles.requestId}>
                          #{String(rowId).padStart(4, '0')}
                        </td>
                        <td>{formatDate(req.createdAt)}</td>
                        <td className={styles.userId}>
                          User #{req.userId ?? '—'}
                        </td>
                        <td className={styles.bankName}>{req.bankName ?? '—'}</td>
                        <td className={styles.accountNum}>{req.accountNumber ?? '—'}</td>
                        <td className={styles.accountName}>{req.accountName ?? '—'}</td>
                        <td className={styles.amount}>{formatAmount(req.amount)}</td>
                        <td className={styles.note}>
                          {req.note
                            ? req.note.length > 40 ? req.note.slice(0, 40) + '…' : req.note
                            : '—'}
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${statusClass(req.status)}`}>
                            {req.status ?? 'Pending'}
                          </span>
                        </td>
                        <td className={styles.actions}>
                          {req.status === 'Pending' ? (
                            <div className={styles.actionBtns}>
                              <button
                                className={styles.approveBtn}
                                onClick={() => handleApprove(req)}
                                disabled={submittingAction}
                                title="Approve this request"
                              >
                                <Check size={13} strokeWidth={3} /> Approve
                              </button>
                              <button
                                className={styles.rejectBtn}
                                onClick={() => openRejectModal(req)}
                                disabled={submittingAction}
                                title="Reject this request"
                              >
                                <X size={13} strokeWidth={3} /> Reject
                              </button>
                            </div>
                          ) : (
                            <button
                              className={styles.viewBtn}
                              title="View details"
                            >
                              <Eye size={13} /> Details
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable reason row for Rejected */}
                      {req.status === 'Rejected' && (
                        <tr key={`${rowId}-reason`} className={styles.reasonRow}>
                          <td colSpan={10}>
                            <div className={styles.reasonCard}>
                              <span className={styles.reasonLabel}>
                                <AlertTriangle size={13} color="#e53e3e" /> Admin Rejection Reason:
                              </span>
                              <span className={styles.reasonText}>
                                {req.rejectionReason ?? 'No reason provided.'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className={styles.actionError}>
          <AlertTriangle size={15} />
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className={styles.dismissBtn}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Reject confirmation modal */}
      {rejectModal && (
        <div className={styles.modalOverlay} onClick={() => setRejectModal(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalIconWrap}>
                <AlertTriangle size={22} color="#e53e3e" />
              </span>
              <div>
                <h3 className={styles.modalTitle}>Reject Withdrawal Request</h3>
                <p className={styles.modalSubtitle}>
                  Request #{String(rejectModal.id ?? rejectModal.withdrawalRequestId).padStart(4, '0')} &mdash; {rejectModal.bankName}
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setRejectModal(null)}>
                <X size={16} />
              </button>
            </div>

            {/* Request summary */}
            <div className={styles.modalSummary}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Amount</span>
                <span className={styles.summaryVal}>{formatAmount(rejectModal.amount)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Account</span>
                <span className={styles.summaryVal}>{rejectModal.accountNumber}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Holder</span>
                <span className={styles.summaryVal}>{rejectModal.accountName}</span>
              </div>
            </div>

            {/* Rejection reason input */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="reject-reason">
                * Rejection Reason <span className={styles.requiredNote}>(required)</span>
              </label>
              <textarea
                id="reject-reason"
                className={styles.reasonInput}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this request is being rejected (min. 10 characters)…"
                rows={4}
                maxLength={1000}
                required
              />
              <span className={styles.charCount}>{rejectReason.length} / 1000</span>
            </div>

            {/* Error inside modal */}
            {actionError && (
              <div className={styles.modalError}>
                <AlertTriangle size={14} /> {actionError}
              </div>
            )}

            {/* Footer */}
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setRejectModal(null)}
                disabled={submittingAction}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmRejectBtn}
                onClick={() => void handleReject()}
                disabled={submittingAction || rejectReason.trim().length < 10}
              >
                {submittingAction ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWithdrawalRequests;

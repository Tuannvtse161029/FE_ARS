import { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  X,
  Building2,
} from 'lucide-react';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { adminService } from '../../services/admin.service';
import type { WithdrawalRequestItem } from '../../types/admin';
import ApprovePayoutModal from './ApprovePayoutModal';
import styles from './TransactionsManagement.module.css';

type Tab = 'revenue' | 'withdrawals';

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('vi-VN').format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const STATUS_CLASS: Record<WithdrawalRequestItem['status'], string> = {
  PENDING: styles.statusPENDING,
  ACCEPTED_PROCESSING: styles.statusACCEPTED_PROCESSING,
  COMPLETED: styles.statusCOMPLETED,
  DENIED: styles.statusDENIED,
};

const STATUS_LABEL: Record<WithdrawalRequestItem['status'], string> = {
  PENDING: 'PENDING MANUAL TRANSFER',
  ACCEPTED_PROCESSING: 'ACCEPTED & PROCESSING',
  COMPLETED: 'COMPLETED',
  DENIED: 'DENIED',
};

export const TransactionsManagement = () => {
  useAdminGuard();

  const [tab, setTab] = useState<Tab>('withdrawals');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeWithdrawal, setActiveWithdrawal] = useState<WithdrawalRequestItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminService.getReviewerWithdrawals();
      setWithdrawals(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load withdrawals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = withdrawals.filter((w) => w.status === 'PENDING').length;

  const openPayout = (w: WithdrawalRequestItem) => {
    setActiveWithdrawal(w);
    setModalOpen(true);
  };

  const handleCompleted = (updated: WithdrawalRequestItem) => {
    setWithdrawals((prev) =>
      prev.map((w) => (w.txId === updated.txId ? updated : w)),
    );
  };

  const quickApprove = async (w: WithdrawalRequestItem) => {
    try {
      const updated = await adminService.markWithdrawalProcessing(w.txId);
      setWithdrawals((prev) =>
        prev.map((item) => (item.txId === updated.txId ? updated : item)),
      );
      setActiveWithdrawal(updated);
      setModalOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start payout.');
    }
  };

  const quickDeny = async (w: WithdrawalRequestItem) => {
    const reason = window.prompt(
      `Reason for denying withdrawal #${String(w.txId).padStart(4, '0')}?`,
    );
    if (!reason || reason.trim().length < 10) {
      if (reason !== null) {
        alert('Denial reason must be at least 10 characters.');
      }
      return;
    }
    try {
      const updated = await adminService.denyWithdrawal(w.txId, reason.trim());
      setWithdrawals((prev) =>
        prev.map((item) => (item.txId === updated.txId ? updated : item)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deny withdrawal.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        Home &gt; Admin &gt; <span className={styles.activeBreadcrumb}>Transactions</span>
      </div>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Transactions</h1>
          <p className={styles.pageSubtitle}>
            Platform revenue and reviewer payout clearance.
          </p>
        </div>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
          onClick={() => {
            setRefreshing(true);
            void load();
          }}
          disabled={refreshing}
          type="button"
        >
          <RefreshCw size={13} className={refreshing ? styles.spinning : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className={styles.tabs} role="tablist">
        <button
          className={`${styles.tab} ${tab === 'revenue' ? styles.tabActive : ''}`}
          onClick={() => setTab('revenue')}
          role="tab"
          aria-selected={tab === 'revenue'}
          type="button"
        >
          <Banknote size={16} />
          Platform Revenue &amp; Transactions
        </button>
        <button
          className={`${styles.tab} ${tab === 'withdrawals' ? styles.tabActive : ''}`}
          onClick={() => setTab('withdrawals')}
          role="tab"
          aria-selected={tab === 'withdrawals'}
          type="button"
        >
          <Building2 size={16} />
          Reviewer Withdrawal Requests
          {pendingCount > 0 && (
            <span className={styles.tabBadge}>{pendingCount}</span>
          )}
        </button>
      </div>

      {tab === 'revenue' && (
        <div className={styles.tableCard}>
          <div className={styles.emptyState}>
            <Banknote size={32} color="#94a3b8" />
            <span>
              Platform Revenue &amp; Transactions will appear here once the BE
              ships the analytics endpoint described in
              <code style={{ padding: '0 4px' }}>docs/local-only/admin-suite-be-gap-report.md</code>.
            </span>
          </div>
        </div>
      )}

      {tab === 'withdrawals' && (
        <div className={styles.tableCard}>
          {loading ? (
            <div className={styles.loadingState}>
              <RefreshCw size={20} className={styles.spinning} />
              <span>Loading withdrawals…</span>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <AlertTriangle size={20} color="#ef4444" />
              <span>{error}</span>
              <button className={styles.retryBtn} onClick={() => void load()}>Retry</button>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className={styles.emptyState}>
              <Building2 size={32} color="#94a3b8" />
              <span>No withdrawal requests yet.</span>
            </div>
          ) : (
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>TX ID</th>
                    <th>REVIEWER</th>
                    <th>AMOUNT (VND)</th>
                    <th>BANK</th>
                    <th>ACCOUNT</th>
                    <th>DATE</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.txId}>
                      <td className={styles.txId}>
                        #{String(w.txId).padStart(4, '0')}
                      </td>
                      <td>{w.reviewerName}</td>
                      <td className={`${styles.amount} ${w.status === 'PENDING' ? styles.amountPending : ''}`}>
                        {formatAmount(w.amountVnd)} VND
                      </td>
                      <td>
                        {w.bankName}
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          {w.accountName}
                        </div>
                      </td>
                      <td>{w.accountNumber}</td>
                      <td>{formatDate(w.requestDate)}</td>
                      <td>
                        <span className={`${styles.statusPill} ${STATUS_CLASS[w.status]}`}>
                          {STATUS_LABEL[w.status]}
                        </span>
                      </td>
                      <td>
                        {w.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className={styles.actionBtn}
                              onClick={() => quickApprove(w)}
                              type="button"
                            >
                              <CheckCircle2 size={13} />
                              Approve &amp; Pay
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                              onClick={() => quickDeny(w)}
                              type="button"
                            >
                              <X size={13} />
                              Deny
                            </button>
                          </div>
                        )}
                        {w.status === 'ACCEPTED_PROCESSING' && (
                          <button
                            className={styles.actionBtn}
                            onClick={() => openPayout(w)}
                            type="button"
                          >
                            Complete Transfer
                          </button>
                        )}
                        {w.status === 'COMPLETED' && (
                          <a
                            href={w.proofReceiptUrl ?? '#'}
                            target="_blank"
                            rel="noreferrer noopener"
                            className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                          >
                            View Receipt
                          </a>
                        )}
                        {w.status === 'DENIED' && (
                          <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
                            {w.rejectionReason || 'Denied'}
                          </span>
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

      <ApprovePayoutModal
        withdrawal={activeWithdrawal}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCompleted={handleCompleted}
      />
    </div>
  );
};

export default TransactionsManagement;

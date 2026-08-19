import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Eye,
  ExternalLink,
  Search,
  X,
} from 'lucide-react';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { usePagination } from '../../hooks/usePagination';
import { adminService } from '../../services/admin.service';
import type { WithdrawalRequestItem } from '../../types/admin';
import ApprovePayoutModal from './ApprovePayoutModal';
import DenyWithdrawalModal from './DenyWithdrawalModal';
import WithdrawalDetailsModal from './WithdrawalDetailsModal';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import styles from './TransactionsManagement.module.css';

type Tab = 'revenue' | 'withdrawals';
type ModalKind = 'details' | 'payout' | 'deny' | null;

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('vi-VN').format(amount);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');
const isValidReceiptUrl = (value?: string | null) => {
  if (!value) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
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
  const [activeWithdrawal, setActiveWithdrawal] =
    useState<WithdrawalRequestItem | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setWithdrawals(await adminService.getReviewerWithdrawals());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load withdrawals.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query
      ? withdrawals.filter((w) =>
          [
            String(w.txId),
            w.reviewerName,
            w.accountName,
            w.accountNumber,
            w.bankName,
            String(w.userId),
          ]
            .join(' ')
            .toLowerCase()
            .includes(query),
        )
      : withdrawals;
    // Newest first by requestDate.
    return [...base].sort(
      (a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime(),
    );
  }, [withdrawals, search]);

  const {
    page,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    pageItems,
    setPage,
    next,
    prev,
    resetPage,
  } = usePagination<WithdrawalRequestItem>(filtered, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, resetPage]);

  const pendingCount = withdrawals.filter(
    (withdrawal) => withdrawal.status === 'PENDING',
  ).length;

  const openModal = (
    withdrawal: WithdrawalRequestItem,
    kind: Exclude<ModalKind, null>,
  ) => {
    setActiveWithdrawal(withdrawal);
    setModal(kind);
  };

  const handleUpdated = (updated: WithdrawalRequestItem) => {
    setWithdrawals((previous) =>
      previous.map((withdrawal) =>
        withdrawal.txId === updated.txId ? updated : withdrawal,
      ),
    );
    setActiveWithdrawal(updated);
  };

  const renderActions = (withdrawal: WithdrawalRequestItem) => (
    <div className={styles.actions}>
      <button
        className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
        onClick={() => openModal(withdrawal, 'details')}
        type="button"
        data-testid="tx-view-details-btn"
      >
        <Eye size={13} />
        View Details
      </button>
      {withdrawal.status === 'PENDING' ? (
        <>
          <button
            className={styles.actionBtn}
            onClick={() => openModal(withdrawal, 'payout')}
            type="button"
            data-testid="tx-approve-btn"
          >
            <CheckCircle2 size={13} />
            Approve &amp; Pay
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => openModal(withdrawal, 'deny')}
            type="button"
            data-testid="tx-deny-btn"
          >
            <X size={13} />
            Deny
          </button>
        </>
      ) : null}
      {withdrawal.status === 'ACCEPTED_PROCESSING' ? (
        <button
          className={styles.actionBtn}
          onClick={() => openModal(withdrawal, 'payout')}
          type="button"
          data-testid="tx-complete-btn"
        >
          <CheckCircle2 size={13} />
          Complete Transfer
        </button>
      ) : null}
      {withdrawal.status === 'COMPLETED' && isValidReceiptUrl(withdrawal.proofReceiptUrl) ? (
        <a
          href={withdrawal.proofReceiptUrl!}
          target="_blank"
          rel="noreferrer noopener"
          className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
        >
          <ExternalLink size={13} />
          View Receipt
        </a>
      ) : null}
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        Home &gt; Admin &gt;{' '}
        <span className={styles.activeBreadcrumb}>Transactions</span>
      </div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Transactions</h1>
          <p className={styles.pageSubtitle}>
            Platform revenue and reviewer payout clearance.
          </p>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Transaction sections">
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
          {pendingCount > 0 ? (
            <span className={styles.tabBadge}>{pendingCount}</span>
          ) : null}
        </button>
      </div>

      {tab === 'revenue' ? (
        <div className={styles.tableCard}>
          <div className={styles.emptyState}>
            <Banknote size={32} />
            <span>
              Platform revenue is unavailable until the backend analytics
              contract is implemented.
            </span>
          </div>
        </div>
      ) : null}

      {tab === 'withdrawals' ? (
        <>
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            isRefreshing={refreshing}
            searchPlaceholder="Search by TX ID, reviewer, bank, or account"
            refreshLabel="Refresh"
            filters={
              <Search size={14} color="#94a3b8" aria-hidden />
            }
          />

          <div className={styles.tableCard}>
            {loading ? (
              <div
                className={styles.loadingState}
                data-testid="tx-loading"
                role="status"
              >
                <span className={styles.spinning} />
                <span>Loading withdrawals…</span>
              </div>
            ) : error ? (
              <div
                className={styles.errorState}
                data-testid="tx-error"
                role="alert"
              >
                <AlertTriangle size={20} />
                <span>{error}</span>
                <button
                  className={styles.retryBtn}
                  onClick={() => void load()}
                  type="button"
                >
                  Retry
                </button>
              </div>
            ) : totalItems === 0 ? (
              <div
                className={styles.emptyState}
                data-testid="tx-empty"
                role="status"
              >
                <Building2 size={32} />
                <span>
                  {search.trim().length > 0
                    ? `No withdrawal requests match "${search.trim()}".`
                    : 'No withdrawal requests yet.'}
                </span>
              </div>
            ) : (
              <>
                <div className={styles.tableResponsive}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>TX ID</th>
                        <th>Reviewer</th>
                        <th>Amount</th>
                        <th>Bank</th>
                        <th>Account</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((withdrawal) => (
                        <tr key={withdrawal.txId} data-testid="tx-row">
                          <td className={styles.txId}>
                            #{String(withdrawal.txId).padStart(4, '0')}
                          </td>
                          <td>
                            {withdrawal.reviewerName}
                            <span className={styles.secondaryText}>
                              ID #{withdrawal.userId}
                            </span>
                          </td>
                          <td
                            className={`${styles.amount} ${
                              withdrawal.status === 'PENDING'
                                ? styles.amountPending
                                : ''
                            }`}
                          >
                            {formatAmount(withdrawal.amountVnd)}{' '}
                            {withdrawal.currency ?? 'VND'}
                          </td>
                          <td>
                            {withdrawal.bankName}
                            <span className={styles.secondaryText}>
                              {withdrawal.accountName}
                            </span>
                          </td>
                          <td>{withdrawal.accountNumber}</td>
                          <td>{formatDate(withdrawal.requestDate)}</td>
                          <td>
                            <span
                              className={`${styles.statusPill} ${
                                styles[`status${withdrawal.status}`]
                              }`}
                            >
                              {STATUS_LABEL[withdrawal.status]}
                            </span>
                          </td>
                          <td>{renderActions(withdrawal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  startIndex={startIndex}
                  endIndex={endIndex}
                  onPrev={prev}
                  onNext={next}
                  onPage={setPage}
                  itemLabel="withdrawal requests"
                />
              </>
            )}
          </div>
        </>
      ) : null}

      <WithdrawalDetailsModal
        withdrawal={activeWithdrawal}
        open={modal === 'details'}
        onClose={() => setModal(null)}
      />
      <DenyWithdrawalModal
        withdrawal={activeWithdrawal}
        open={modal === 'deny'}
        onClose={() => setModal(null)}
        onDenied={handleUpdated}
      />
      <ApprovePayoutModal
        withdrawal={activeWithdrawal}
        open={modal === 'payout'}
        onClose={() => setModal(null)}
        onCompleted={handleUpdated}
      />
    </div>
  );
};

export default TransactionsManagement;

/**
 * TransactionsManagement — Platform revenue + reviewer payouts.
 *
 * Two-tab layout. The revenue tab ships as an honest unavailable state
 * until the analytics contract is implemented; the withdrawals tab is
 * gated by AppConfig.features.enableWithdrawals.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  CheckCircle2,
  Eye,
  ExternalLink,
  Search as SearchIcon,
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
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import { AppConfig } from '../../config/app';
import styles from './TransactionsManagement.module.css';

type Tab = 'revenue' | 'withdrawals';
type ModalKind = 'details' | 'payout' | 'deny' | null;

const ROLE_ACCENT = 'var(--ars-admin)';

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

// Centralized withdrawal feature gate: while disabled, the Admin's
// "Reviewer Withdrawal Requests" tab is omitted entirely, the table /
// modals / actions are not rendered, and an informational notice is shown
// in its place. Wallet balance, top-up, and other admin functions are NOT
// affected. Restore by toggling `AppConfig.features.enableWithdrawals`.
const WITHDRAWAL_DISABLED_MESSAGE =
  'Reviewer withdrawal requests are temporarily unavailable while the requirements are being revised. Approve / Deny / Transfer actions and payout receipts are paused; all other admin functions remain active.';

export const TransactionsManagement = () => {
  useAdminGuard();
  const withdrawalsEnabled = AppConfig.features.enableWithdrawals === true;
  // When withdrawals are disabled, default to the revenue tab. Re-enabling
  // the flag does NOT auto-switch the active tab — the Admin keeps their
  // selection, which may now be revenue.
  const [tab, setTab] = useState<Tab>(withdrawalsEnabled ? 'withdrawals' : 'revenue');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeWithdrawal, setActiveWithdrawal] =
    useState<WithdrawalRequestItem | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!withdrawalsEnabled) {
      // Gate the load — even if a stale caller invokes `load()` (e.g. via the
      // refresh button before the disabled notice finishes rendering), the
      // underlying admin withdrawal call is short-circuited at the service.
      setWithdrawals([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
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
  }, [withdrawalsEnabled]);

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
      <PageHeader
        eyebrow="ADMIN · TRANSACTIONS"
        title="Transactions"
        description="Platform revenue and reviewer payout clearance."
        accent={ROLE_ACCENT}
      />

      <div className={styles.tabs} role="tablist" aria-label="Transaction sections">
        <button
          className={`${styles.tab} ${tab === 'revenue' ? styles.tabActive : ''}`}
          onClick={() => setTab('revenue')}
          role="tab"
          aria-selected={tab === 'revenue'}
          type="button"
        >
          <Banknote size={14} />
          Platform Revenue &amp; Transactions
        </button>
        {withdrawalsEnabled && (
          <button
            className={`${styles.tab} ${tab === 'withdrawals' ? styles.tabActive : ''}`}
            onClick={() => setTab('withdrawals')}
            role="tab"
            aria-selected={tab === 'withdrawals'}
            type="button"
          >
            <Building2 size={14} />
            Reviewer Withdrawal Requests
            {pendingCount > 0 ? (
              <span className={styles.tabBadge}>{pendingCount}</span>
            ) : null}
          </button>
        )}
      </div>

      {tab === 'revenue' ? (
        <div className={styles.tableCard}>
          <div
            className={styles.disabledNotice}
            data-testid="admin-revenue-unavailable"
            role="status"
          >
            <Banknote size={28} />
            <strong>Backend analytics unavailable</strong>
            <span>
              Platform revenue is unavailable until the backend analytics
              contract is implemented.
            </span>
          </div>
        </div>
      ) : null}

      {/* Withdrawal tab content: gated by the centralized feature flag.
          While disabled, only the informational notice renders (no table,
          search, refresh button, modal triggers, or payout receipts). */}
      {tab === 'withdrawals' && !withdrawalsEnabled ? (
        <div className={styles.tableCard}>
          <div
            className={styles.disabledNotice}
            data-testid="admin-withdrawal-disabled-notice"
            role="status"
          >
            <strong>Feature temporarily paused</strong>
            <span>{WITHDRAWAL_DISABLED_MESSAGE}</span>
          </div>
        </div>
      ) : null}

      {tab === 'withdrawals' && withdrawalsEnabled ? (
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
              <SearchIcon
                size={14}
                aria-hidden
                className={styles.toolbarIcon}
              />
            }
          />

          <div className={styles.tableCard}>
            {loading ? (
              <div
                className={styles.loadingState}
                data-testid="tx-loading"
                role="status"
              >
                <SkeletonRow count={8} rowHeight={28} withHeader />
              </div>
            ) : error ? (
              <div
                data-testid="tx-error"
                className={styles.errorWrap}
              >
                <ErrorBanner
                  tone="error"
                  title="Could not load withdrawals"
                  message={error}
                  retry={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void load()}
                      disabled={loading || refreshing}
                    >
                      {loading || refreshing ? 'Retrying…' : 'Retry'}
                    </Button>
                  }
                />
              </div>
            ) : totalItems === 0 ? (
              <div
                className={styles.emptyWrap}
                data-testid="tx-empty"
              >
                <EmptyState
                  icon={<Building2 size={20} />}
                  title={
                    search.trim().length > 0
                      ? `No withdrawal requests match "${search.trim()}".`
                      : 'No withdrawal requests yet.'
                  }
                  description="When a reviewer submits a withdrawal, it will appear here for clearance."
                />
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
        withdrawal={withdrawalsEnabled ? activeWithdrawal : null}
        open={withdrawalsEnabled && modal === 'details'}
        onClose={() => setModal(null)}
      />
      <DenyWithdrawalModal
        withdrawal={withdrawalsEnabled ? activeWithdrawal : null}
        open={withdrawalsEnabled && modal === 'deny'}
        onClose={() => setModal(null)}
        onDenied={handleUpdated}
      />
      <ApprovePayoutModal
        withdrawal={withdrawalsEnabled ? activeWithdrawal : null}
        open={withdrawalsEnabled && modal === 'payout'}
        onClose={() => setModal(null)}
        onCompleted={handleUpdated}
      />
    </div>
  );
};

export default TransactionsManagement;

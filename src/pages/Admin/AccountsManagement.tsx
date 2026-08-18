import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Inbox,
  Eye,
  Pause,
  Play,
} from 'lucide-react';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { usePagination } from '../../hooks/usePagination';
import { adminService } from '../../services/admin.service';
import type {
  AccountItem,
  AccountStatus,
  AccountPlan,
  AccountRoleName,
} from '../../types/admin';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import styles from './AccountsManagement.module.css';

type StatusFilter = 'ALL' | AccountStatus;
type PlanFilter = 'ALL' | AccountPlan;
type RoleFilter = 'ALL' | AccountRoleName;

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

const formatSuspendedUntil = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

interface ConfirmState {
  account: AccountItem;
  next: AccountStatus;
}

export const AccountsManagement = () => {
  useAdminGuard();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [plan, setPlan] = useState<PlanFilter>('ALL');
  const [role, setRole] = useState<RoleFilter>('ALL');

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminService.getAccounts({
        search,
        status,
        plan,
        role,
      });
      setAccounts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, status, plan, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const onConfirm = async () => {
    if (!confirm) return;
    const id = confirm.account.id;
    setActingId(id);
    try {
      const updated =
        confirm.next === 'SUSPENDED'
          ? await adminService.suspendAccount(id)
          : await adminService.unsuspendAccount(id);
      setAccounts((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update account.');
    } finally {
      setActingId(null);
    }
  };

  const planClass = (p: AccountPlan) =>
    p === 'PREMIUM' ? styles.planPremium : styles.planFreeTier;
  const statusClass = (s: AccountStatus) =>
    s === 'ACTIVE' ? styles.statusActive : styles.statusSuspended;

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

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
  } = usePagination<AccountItem>(sorted, DEFAULT_PAGE_SIZE);

  // Spec: every search/filter change resets to page 1 so a stale index
  // never hides rows that belong to the new filter.
  useEffect(() => {
    resetPage();
  }, [search, status, plan, role, resetPage]);

  const hasNoMatch =
    !loading &&
    !error &&
    totalItems === 0 &&
    (search.trim().length > 0 ||
      status !== 'ALL' ||
      plan !== 'ALL' ||
      role !== 'ALL');

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        Home &gt; Admin &gt;{' '}
        <span className={styles.activeBreadcrumb}>Accounts</span>
      </div>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Accounts Management</h1>
          <p className={styles.pageSubtitle}>
            Search, filter, and moderate user accounts across roles and plans.
          </p>
        </div>
      </div>

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        isRefreshing={refreshing}
        searchPlaceholder="Search by name, email, or ID"
        refreshLabel="Refresh"
        filters={
          <>
            <select
              className={styles.select}
              value={role}
              onChange={(e) => setRole(e.target.value as RoleFilter)}
              aria-label="Filter by role"
              data-testid="accounts-role-filter"
            >
              <option value="ALL">All Roles</option>
              <option value="LECTURER">Lecturer</option>
              <option value="RESEARCHER">Researcher</option>
              <option value="REVIEWER">Reviewer</option>
              <option value="GRADUATE_STUDENT">Graduate Student</option>
            </select>
            <select
              className={styles.select}
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlanFilter)}
              aria-label="Filter by plan"
              data-testid="accounts-plan-filter"
            >
              <option value="ALL">All Plans</option>
              <option value="PREMIUM">Premium</option>
              <option value="FREE_TIER">Free Tier</option>
            </select>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              aria-label="Filter by status"
              data-testid="accounts-status-filter"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </>
        }
      />

      <div className={styles.tableCard}>
        {loading ? (
          <div
            className={styles.loadingState}
            data-testid="accounts-loading"
            role="status"
          >
            <span className={styles.spinning} />
            <span>Loading accounts…</span>
          </div>
        ) : error ? (
          <div
            className={styles.errorState}
            data-testid="accounts-error"
            role="alert"
          >
            <AlertTriangle size={20} color="#ef4444" />
            <span>{error}</span>
            <button className={styles.retryBtn} onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : hasNoMatch ? (
          <div
            className={styles.emptyState}
            data-testid="accounts-empty"
            role="status"
          >
            <Inbox size={32} color="#94a3b8" />
            <span>No accounts match the current filters.</span>
          </div>
        ) : totalItems === 0 ? (
          <div
            className={styles.emptyState}
            data-testid="accounts-empty"
            role="status"
          >
            <Inbox size={32} color="#94a3b8" />
            <span>No accounts have been provisioned yet.</span>
          </div>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>USER</th>
                    <th>ROLES</th>
                    <th>PLAN</th>
                    <th>JOINED</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.avatar}>
                            {initialsOf(a.name)}
                          </div>
                          <div className={styles.userMeta}>
                            <span className={styles.userName}>{a.name}</span>
                            <span className={styles.userEmail}>{a.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {a.roles.map((r) => (
                          <span key={r} className={styles.roleTag}>
                            {r}
                          </span>
                        ))}
                      </td>
                      <td>
                        <span
                          className={`${styles.planTag} ${planClass(a.plan)}`}
                        >
                          {a.plan === 'PREMIUM' ? 'Premium' : 'Free Tier'}
                        </span>
                      </td>
                      <td>
                        {new Date(a.joinedDate).toLocaleDateString('vi-VN')}
                      </td>
                      <td>
                        <div className={styles.statusCell}>
                          <span
                            className={`${styles.statusTag} ${statusClass(a.status)}`}
                          >
                            {a.status}
                          </span>
                          {a.status === 'SUSPENDED' && a.suspendedUntil ? (
                            <span
                              className={styles.suspendedUntilPill}
                              title={`Auto-lifted on ${formatSuspendedUntil(
                                a.suspendedUntil,
                              )}`}
                            >
                              until {formatSuspendedUntil(a.suspendedUntil)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className={styles.actionBtns}>
                          <button
                            className={styles.actionBtn}
                            onClick={() =>
                              window.open(`/profile/${a.id}`, '_blank')
                            }
                            title="View profile"
                            type="button"
                          >
                            <Eye
                              size={13}
                              style={{
                                marginRight: 4,
                                verticalAlign: '-2px',
                              }}
                            />
                            View Profile
                          </button>
                          {a.status === 'ACTIVE' ? (
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              onClick={() =>
                                setConfirm({ account: a, next: 'SUSPENDED' })
                              }
                              disabled={actingId === a.id}
                              type="button"
                            >
                              <Pause
                                size={13}
                                style={{
                                  marginRight: 4,
                                  verticalAlign: '-2px',
                                }}
                              />
                              Suspend User
                            </button>
                          ) : (
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                              onClick={() =>
                                setConfirm({ account: a, next: 'ACTIVE' })
                              }
                              disabled={actingId === a.id}
                              type="button"
                            >
                              <Play
                                size={13}
                                style={{
                                  marginRight: 4,
                                  verticalAlign: '-2px',
                                }}
                              />
                              Unsuspend User
                            </button>
                          )}
                        </div>
                      </td>
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
              itemLabel="accounts"
            />
          </>
        )}
      </div>

      {confirm && (
        <div
          className={styles.modalOverlay}
          onClick={() => setConfirm(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={styles.modalTitle}>
              {confirm.next === 'SUSPENDED'
                ? 'Suspend Account?'
                : 'Unsuspend Account?'}
            </span>
            <p className={styles.modalBody}>
              {confirm.next === 'SUSPENDED' ? (
                <>
                  You are about to suspend{' '}
                  <strong>{confirm.account.name}</strong> ({confirm.account.email}
                  ). They will be unable to sign in or take action on the
                  platform until you unsuspend them.
                </>
              ) : (
                <>
                  You are about to restore access for{' '}
                  <strong>{confirm.account.name}</strong> ({confirm.account.email}
                  ).
                </>
              )}
            </p>
            <div className={styles.modalActions}>
              <button
                className={`${styles.modalBtn} ${styles.cancelBtn}`}
                onClick={() => setConfirm(null)}
                disabled={actingId !== null}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`${styles.modalBtn} ${
                  confirm.next === 'SUSPENDED'
                    ? styles.confirmBtnSuspend
                    : styles.confirmBtnUnsuspend
                }`}
                onClick={() => void onConfirm()}
                disabled={actingId !== null}
                type="button"
              >
                {confirm.next === 'SUSPENDED' ? 'Suspend' : 'Unsuspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsManagement;

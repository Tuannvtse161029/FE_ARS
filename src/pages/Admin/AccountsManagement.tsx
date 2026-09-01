/**
 * AccountsManagement — Admin user moderation queue.
 *
 * Search + role/plan/status filters + suspend/unsuspend inline modal.
 * Uses the shared PageHeader, TableToolbar, TablePagination, ErrorBanner,
 * and EmptyState primitives. All inline styles in the original file have
 * been moved to CSS Modules.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, Eye, Pause, Play } from 'lucide-react';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { useAuth } from '../../context/AuthContext';
import { usePagination } from '../../hooks/usePagination';
import { useTableSort } from '../../hooks/useTableSort';
import { adminService } from '../../services/admin.service';
import type {
  AccountItem,
  AccountStatus,
  AccountPlan,
  AccountRoleName,
} from '../../types/admin';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { SortableHeader } from '../../components/table/SortableHeader';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import styles from './AccountsManagement.module.css';

type StatusFilter = 'ALL' | AccountStatus;
type PlanFilter = 'ALL' | AccountPlan;
type RoleFilter = 'ALL' | AccountRoleName;

/** Sortable column ids for the Accounts table. */
type SortColumn = 'name' | 'email' | 'roles' | 'plan' | 'joined' | 'status';

const ROLE_ACCENT = 'var(--ars-admin)';

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

  const { user: currentAuth } = useAuth();
  const currentUserId = currentAuth?.userId ?? null;

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
    if (currentUserId != null && currentUserId === id) {
      setError('You cannot suspend or restore your own admin account.');
      setConfirm(null);
      return;
    }
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

  // Default sort by joinedDate (newest first) so newly registered accounts
  // surface at the top. The user can override per column header click.
  const sort = useTableSort<AccountItem, SortColumn>('joined', 'desc');

  const sorted = useMemo(
    () =>
      sort.sortedItemsBy(accounts, (row) => {
        switch (sort.sortState.column) {
          case 'name':
            return row.name ?? '';
          case 'email':
            return row.email ?? '';
          case 'roles':
            return row.roles.join(', ');
          case 'plan':
            return row.plan;
          case 'status':
            return row.status;
          case 'joined':
          default:
            return row.joinedDate ?? null;
        }
      }),
    [accounts, sort],
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
  }, [search, status, plan, role, sort.sortState, resetPage]);

  const hasNoMatch =
    !loading &&
    !error &&
    totalItems === 0 &&
    (search.trim().length > 0 ||
      status !== 'ALL' ||
      plan !== 'ALL' ||
      role !== 'ALL');

  const isSelf = (id: number) =>
    currentUserId != null && currentUserId === id;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="ADMIN · ACCOUNTS"
        title="Accounts Management"
        description="Search, filter, and moderate user accounts across roles and plans."
        accent={ROLE_ACCENT}
      />

      <TableToolbar
        search={search}
        onSearchChange={error ? () => undefined : setSearch}
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
            <SkeletonRow count={8} rowHeight={28} withHeader />
          </div>
        ) : error ? (
          <div data-testid="accounts-error" className={styles.errorWrap}>
            <ErrorBanner
              tone="error"
              title="Could not load accounts"
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
        ) : hasNoMatch ? (
          <div className={styles.emptyWrap}>
            <EmptyState
              icon={<Inbox size={20} />}
              title="No accounts match the current filters."
              description="Adjust the search query or clear one of the role/plan/status filters."
            />
          </div>
        ) : totalItems === 0 ? (
          <div className={styles.emptyWrap}>
            <EmptyState
              icon={<Inbox size={20} />}
              title="No accounts have been provisioned yet."
              description="When new users register, they will appear in this list."
            />
          </div>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>
                      <SortableHeader
                        column="name"
                        label="User"
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="roles"
                        label="Roles"
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="plan"
                        label="Plan"
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                        filterOptions={[
                          { value: 'ALL', label: 'All plans' },
                          { value: 'PREMIUM', label: 'Premium' },
                          { value: 'FREE_TIER', label: 'Free Tier' },
                        ]}
                        activeFilter={plan}
                        onFilterChange={(next) => setPlan(next as PlanFilter)}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="joined"
                        label="Joined"
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="status"
                        label="Status"
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                        filterOptions={[
                          { value: 'ALL', label: 'All statuses' },
                          { value: 'ACTIVE', label: 'Active' },
                          { value: 'SUSPENDED', label: 'Suspended' },
                        ]}
                        activeFilter={status}
                        onFilterChange={(next) => setStatus(next as StatusFilter)}
                      />
                    </th>
                    <th>Actions</th>
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
                            <Eye size={13} />
                            View Profile
                          </button>
                          {a.status === 'ACTIVE' ? (
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              onClick={() =>
                                setConfirm({ account: a, next: 'SUSPENDED' })
                              }
                              disabled={actingId === a.id || isSelf(a.id)}
                              title={
                                isSelf(a.id)
                                  ? 'You cannot suspend your own admin account.'
                                  : undefined
                              }
                              type="button"
                            >
                              <Pause size={13} />
                              Suspend
                            </button>
                          ) : (
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                              onClick={() =>
                                setConfirm({ account: a, next: 'ACTIVE' })
                              }
                              disabled={actingId === a.id || isSelf(a.id)}
                              title={
                                isSelf(a.id)
                                  ? 'You cannot change the status of your own admin account.'
                                  : undefined
                              }
                              type="button"
                            >
                              <Play size={13} />
                              Unsuspend
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
          aria-labelledby="accounts-confirm-title"
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              id="accounts-confirm-title"
              className={styles.modalTitle}
            >
              {confirm.next === 'SUSPENDED'
                ? 'Suspend account?'
                : 'Unsuspend account?'}
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

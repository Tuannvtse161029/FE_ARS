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
import { useI18n } from '../../i18n/I18nContext';
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
  const { t } = useI18n();
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
      setError(e instanceof Error ? e.message : t('admin.accounts.error.failedToLoad'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, status, plan, role, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onConfirm = async () => {
    if (!confirm) return;
    const id = confirm.account.id;
    if (currentUserId != null && currentUserId === id) {
      setError(t('admin.accounts.error.cannotSuspendSelf'));
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
      setError(e instanceof Error ? e.message : t('admin.accounts.error.failedToUpdate'));
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
        eyebrow={t('admin.accounts.eyebrow')}
        title={t('admin.accounts.title')}
        description={t('admin.accounts.description')}
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
        searchPlaceholder={t('admin.accounts.searchPlaceholder')}
        refreshLabel={t('admin.accounts.refresh')}
        filters={
          <>
            <select
              className={styles.select}
              value={role}
              onChange={(e) => setRole(e.target.value as RoleFilter)}
              aria-label="Filter by role"
              data-testid="accounts-role-filter"
            >
              <option value="ALL">{t('admin.accounts.filter.allRoles')}</option>
              <option value="LECTURER">{t('admin.accounts.filter.role.lecturer')}</option>
              <option value="RESEARCHER">{t('admin.accounts.filter.role.researcher')}</option>
              <option value="REVIEWER">{t('admin.accounts.filter.role.reviewer')}</option>
              <option value="GRADUATE_STUDENT">{t('admin.accounts.filter.role.graduateStudent')}</option>
            </select>
            <select
              className={styles.select}
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlanFilter)}
              aria-label="Filter by plan"
              data-testid="accounts-plan-filter"
            >
              <option value="ALL">{t('admin.accounts.filter.allPlans')}</option>
              <option value="PREMIUM">{t('admin.accounts.filter.plan.premium')}</option>
              <option value="FREE_TIER">{t('admin.accounts.filter.plan.freeTier')}</option>
            </select>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              aria-label="Filter by status"
              data-testid="accounts-status-filter"
            >
              <option value="ALL">{t('admin.accounts.filter.allStatuses')}</option>
              <option value="ACTIVE">{t('admin.accounts.filter.status.active')}</option>
              <option value="SUSPENDED">{t('admin.accounts.filter.status.suspended')}</option>
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
              title={t('admin.accounts.error.loadFailed')}
              message={error}
              retry={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void load()}
                  disabled={loading || refreshing}
                >
                  {loading || refreshing ? t('admin.accounts.retrying') : t('admin.accounts.retry')}
                </Button>
              }
            />
          </div>
        ) : hasNoMatch ? (
          <div className={styles.emptyWrap}>
            <EmptyState
              icon={<Inbox size={20} />}
              title={t('admin.accounts.empty.noMatchTitle')}
              description={t('admin.accounts.empty.noMatchDesc')}
            />
          </div>
        ) : totalItems === 0 ? (
          <div className={styles.emptyWrap}>
            <EmptyState
              icon={<Inbox size={20} />}
              title={t('admin.accounts.empty.noDataTitle')}
              description={t('admin.accounts.empty.noDataDesc')}
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
                        label={t('admin.accounts.table.user')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="roles"
                        label={t('admin.accounts.table.roles')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="plan"
                        label={t('admin.accounts.table.plan')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                        filterOptions={[
                          { value: 'ALL', label: t('admin.accounts.filter.allPlans') },
                          { value: 'PREMIUM', label: t('admin.accounts.filter.plan.premium') },
                          { value: 'FREE_TIER', label: t('admin.accounts.filter.plan.freeTier') },
                        ]}
                        activeFilter={plan}
                        onFilterChange={(next) => setPlan(next as PlanFilter)}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="joined"
                        label={t('admin.accounts.table.joined')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="status"
                        label={t('admin.accounts.table.status')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                        filterOptions={[
                          { value: 'ALL', label: t('admin.accounts.filter.allStatuses') },
                          { value: 'ACTIVE', label: t('admin.accounts.filter.status.active') },
                          { value: 'SUSPENDED', label: t('admin.accounts.filter.status.suspended') },
                        ]}
                        activeFilter={status}
                        onFilterChange={(next) => setStatus(next as StatusFilter)}
                      />
                    </th>
                    <th>{t('admin.accounts.table.actions')}</th>
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
                          {a.plan === 'PREMIUM' ? t('admin.accounts.filter.plan.premium') : t('admin.accounts.filter.plan.freeTier')}
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
                            {a.status === 'ACTIVE' ? t('admin.accounts.filter.status.active') : t('admin.accounts.filter.status.suspended')}
                          </span>
                          {a.status === 'SUSPENDED' && a.suspendedUntil ? (
                            <span
                              className={styles.suspendedUntilPill}
                              title={`${t('admin.accounts.status.autoLiftedOn')} ${formatSuspendedUntil(
                                a.suspendedUntil,
                              )}`}
                            >
                              {t('admin.accounts.status.until')} {formatSuspendedUntil(a.suspendedUntil)}
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
                            title={t('admin.accounts.action.viewProfile')}
                            type="button"
                          >
                            <Eye size={13} />
                            {t('admin.accounts.action.viewProfile')}
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
                                  ? t('admin.accounts.action.suspendTitle')
                                  : undefined
                              }
                              type="button"
                            >
                              <Pause size={13} />
                              {t('admin.accounts.action.suspend')}
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
                                  ? t('admin.accounts.action.unsuspendTitle')
                                  : undefined
                              }
                              type="button"
                            >
                              <Play size={13} />
                              {t('admin.accounts.action.unsuspend')}
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
              itemLabel={t('admin.accounts.itemLabel')}
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
                ? t('admin.accounts.modal.suspendTitle')
                : t('admin.accounts.modal.unsuspendTitle')}
            </span>
            <p className={styles.modalBody}>
              {confirm.next === 'SUSPENDED' ? (
                <>
                  {t('admin.accounts.modal.suspendBody')
                    .replace('{name}', confirm.account.name)
                    .replace('{email}', confirm.account.email)}
                </>
              ) : (
                <>
                  {t('admin.accounts.modal.unsuspendBody')
                    .replace('{name}', confirm.account.name)
                    .replace('{email}', confirm.account.email)}
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
                {t('common.cancel')}
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
                {confirm.next === 'SUSPENDED' ? t('admin.accounts.action.suspend') : t('admin.accounts.action.unsuspend')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsManagement;

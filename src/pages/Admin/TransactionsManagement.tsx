/**
 * TransactionsManagement — Admin audit log for ARS payment events.
 *
 * Wires the live BE `/api/Transaction/paged` contract. The page exposes:
 *
 *   - Filter toolbar: free-text search, status filter, type filter
 *   - Paged table of every transaction (subscription purchases, wallet
 *     top-ups, withdrawals, reviewer payouts)
 *   - User name + plan name lookups for human-readable rows
 *   - Pagination controls + "Showing X–Y of Z" summary
 *
 * No mock rows. Every cell comes from a BE call:
 *   - `/api/Transaction/paged?PageNumber=&PageSize=&Search=` → list
 *   - `/api/User/{id}`                                     → user name
 *   - `/api/AnnualFees/{id}`                               → plan name
 *
 * Note — the BE's paged list does not natively support filtering by
 * `userId` or `status` query params. We therefore fetch the BE page
 * and apply status / type filters client-side. The free-text `Search`
 * needle is forwarded to the BE so it can match on description /
 * paymentDescription / paymentOrderId.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import { transactionService } from '../../services/transaction.service';
import { annualFeeService } from '../../services/annualFee.service';
import { userService } from '../../services/user.service';
import type {
  TransactionPagedResult,
  TransactionResponse,
} from '../../types/transaction';
import type { AnnualFee } from '../../types/annualFee';
import type { User } from '../../types/auth';
import styles from './TransactionsManagement.module.css';

const ROLE_ACCENT = 'var(--ars-admin)';
const PAGE_SIZE = 20;
const USER_LOOKUP_BATCH_SIZE = 8;
/**
 * Hard ceiling on the number of unique user ids we resolve in one
 * table render. Without a cap, a 1k-row page with 1k distinct userIds
 * would fire 1k parallel /api/User/{id} calls and pin the BE.
 */
const MAX_USER_LOOKUPS = 200;

/**
 * Module-level lookup caches. Persist across re-renders AND across
 * pagination transitions so that going from page 1 → 2 → 1 does not
 * re-fetch names we already resolved. Each entry is one of:
 *   - `string`                  → resolved display name
 *   - `User | AnnualFee | null` → resolved object (we extract name on read)
 *   - `true`                    → a request is currently in flight
 *   - `false`                   → the lookup failed (sentinel)
 */
const userLookupCache: Map<number, string | User | boolean> = new Map();
const planLookupCache: Map<number, string | AnnualFee | boolean> = new Map();

const formatVnd = (value: number | null | undefined): string => {
  if (typeof value !== 'number') return '—';
  return new Intl.NumberFormat('vi-VN').format(value);
};

const formatDateTime = (
  iso: string | null | undefined,
  locale: 'vi' | 'en',
): string => {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const tag = locale === 'vi' ? 'vi-VN' : 'en-US';
  return new Date(ts).toLocaleString(tag, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Map a free-form BE status string to a CSS modifier class. The BE
 * emits a small set of well-known values (Pending / Paid / Failed /
 * Cancelled) but we also tolerate case variations and a few common
 * synonyms.
 */
const statusPillClass = (status: string | null | undefined): string => {
  if (!status) return styles.statusPill_neutral;
  const normalised = status.toLowerCase().replace(/[^a-z]+/g, '_');
  const key = `statusPill_${normalised}` as keyof typeof styles;
  if (key in styles) {
    return styles[key] as string;
  }
  return styles.statusPill_neutral;
};

export const TransactionsManagement = () => {
  const { t } = useI18n();
  const locale = useLocale();
  useAdminGuard();

  // Server-paged state. The BE returns one page at a time; we track
  // only the current page + total counts in component state.
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  // Debounced search input. We don't want to fire a BE request on
  // every keystroke — a 350ms debounce keeps the load low.
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage((current) => {
        if (current === 1) {
          // Already on the first page — just push the new search
          // into state and let the fetch effect pick it up.
          setSearch(searchInput.trim());
          return 1;
        }
        setSearch(searchInput.trim());
        return 1;
      });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const [paged, setPaged] = useState<TransactionPagedResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // User / plan lookups. We resolve via module-level caches (see the
  // top of this file) so names survive pagination. The state here is
  // a tick counter — bumping it forces a re-render so the table can
  // pick up newly resolved names.
  const [, setLookupTick] = useState(0);
  const inFlightUsers = useRef<Set<number>>(new Set());

  const bumpLookupTick = useCallback(() => {
    setLookupTick((n) => n + 1);
  }, []);

  const fetchPage = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await transactionService.listTransactionsPaged({
          page: nextPage,
          pageSize: PAGE_SIZE,
          search: search || undefined,
        });
        setPaged(result);
        setPage(nextPage);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught
            : new Error('Failed to load transactions.'),
        );
        setPaged(null);
      } finally {
        setIsLoading(false);
      }
    },
    [search],
  );

  // Re-fetch on page or search change. Status / type filters are
  // applied client-side, so they do NOT trigger a new BE call.
  useEffect(() => {
    void fetchPage(page);
  }, [fetchPage, page]);

  const rows = paged?.items ?? [];

  // Client-side filter: status + type. The BE's paged list does not
  // accept these as query params, so we narrow the result here. The
  // pagination summary still reflects the BE's totalCount (i.e. the
  // unfiltered size) so the admin can see "X matched / Y total".
  const filteredRows = useMemo<TransactionResponse[]>(() => {
    if (!statusFilter && !typeFilter) return rows;
    return rows.filter((row) => {
      if (statusFilter && (row.status ?? '') !== statusFilter) {
        return false;
      }
      if (typeFilter && (row.type ?? '') !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [rows, statusFilter, typeFilter]);

  // Collect every unique userId / annualFeeId in the current page so
  // we can resolve them in one batch. Capped at MAX_USER_LOOKUPS to
  // avoid runaway fan-out on huge pages.
  const userIdsToResolve = useMemo<number[]>(() => {
    const ids = new Set<number>();
    for (const row of filteredRows) {
      if (typeof row.userId === 'number') ids.add(row.userId);
      if (ids.size >= MAX_USER_LOOKUPS) break;
    }
    return Array.from(ids);
  }, [filteredRows]);

  const planIdsToResolve = useMemo<number[]>(() => {
    const ids = new Set<number>();
    for (const row of filteredRows) {
      if (typeof row.annualFeeId === 'number') ids.add(row.annualFeeId);
    }
    return Array.from(ids);
  }, [filteredRows]);

  // Look up user names via the existing `userService.getById` so we
  // route through the shared axios instance (auth header, base URL,
  // 401 handling). The fetch-via-window helper is intentionally NOT
  // used here — the axios interceptor already handles session
  // cleanup on token expiry.
  //
  // The module-level `userLookupCache` persists across re-renders AND
  // across page transitions, so once we've resolved a name we never
  // re-fetch it. We do NOT include the cache in the effect's deps —
  // doing so would cancel every in-flight request whenever a name
  // resolves, leaving rows stuck on "User #N" forever.
  useEffect(() => {
    if (userIdsToResolve.length === 0) return;
    const queue: number[] = [];
    for (const userId of userIdsToResolve) {
      if (userLookupCache.has(userId)) continue; // already resolved or pending
      queue.push(userId);
    }
    if (queue.length === 0) return;
    const runBatch = async () => {
      const slice = queue.splice(0, USER_LOOKUP_BATCH_SIZE);
      await Promise.allSettled(
        slice.map(async (userId) => {
          inFlightUsers.current.add(userId);
          userLookupCache.set(userId, true);
          try {
            const user: User = await userService.getById(userId);
            userLookupCache.set(userId, user);
          } catch {
            userLookupCache.set(userId, false);
          } finally {
            inFlightUsers.current.delete(userId);
            bumpLookupTick();
          }
        }),
      );
      if (queue.length > 0) {
        await runBatch();
      }
    };
    void runBatch();
  }, [userIdsToResolve, bumpLookupTick]);

  // Look up annual-fee plan names via the existing service. Same
  // module-level-cache + dependency-minimisation pattern as the user
  // lookups above.
  useEffect(() => {
    if (planIdsToResolve.length === 0) return;
    const queue: number[] = [];
    for (const planId of planIdsToResolve) {
      if (planLookupCache.has(planId)) continue;
      queue.push(planId);
    }
    if (queue.length === 0) return;
    (async () => {
      for (const planId of queue) {
        planLookupCache.set(planId, true);
        try {
          const plan: AnnualFee = await annualFeeService.getAnnualFeePlan(planId);
          planLookupCache.set(planId, plan);
        } catch {
          planLookupCache.set(planId, false);
        }
        bumpLookupTick();
      }
    })();
  }, [planIdsToResolve, bumpLookupTick]);

  const totalCount = paged?.totalCount ?? 0;
  const totalPages = Math.max(1, paged?.totalPages ?? 1);
  const showingFrom =
    totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, totalCount);
  const statusOptions = useMemo<string[]>(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.status) seen.add(row.status);
    }
    // Always include the canonical four so the dropdown is stable
    // across page transitions.
    for (const s of ['Pending', 'Paid', 'Failed', 'Cancelled']) {
      seen.add(s);
    }
    return Array.from(seen).sort();
  }, [rows]);
  const typeOptions = useMemo<string[]>(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.type) seen.add(row.type);
    }
    for (const s of ['AnnualFee', 'Topup', 'Withdrawal', 'Payout']) {
      seen.add(s);
    }
    return Array.from(seen).sort();
  }, [rows]);

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setPage(1);
  };

  const filtersActive = Boolean(
    search || statusFilter || typeFilter || searchInput,
  );

  return (
    <div className={styles.page} data-component="TransactionsManagementPage">
      <PageHeader
        title={t('admin.transactions.title')}
        description={t('admin.transactions.description')}
        accent={ROLE_ACCENT}
      />

      <div className={styles.toolbar} role="search">
        <div
          className={`${styles.toolbarField} ${styles.toolbarFieldSearch}`}
        >
          <label className={styles.toolbarLabel} htmlFor="tx-search">
            {t('admin.transactions.filter.searchLabel')}
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              aria-hidden
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ars-ink-muted)',
              }}
            />
            <input
              id="tx-search"
              className={styles.toolbarInput}
              type="search"
              placeholder={t('admin.transactions.searchPlaceholder')}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              style={{ paddingLeft: 30, width: '100%' }}
              data-testid="tx-search"
            />
          </div>
        </div>
        <div className={styles.toolbarField}>
          <label className={styles.toolbarLabel} htmlFor="tx-status">
            {t('admin.transactions.filter.statusLabel')}
          </label>
          <select
            id="tx-status"
            className={styles.toolbarSelect}
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            data-testid="tx-status-filter"
          >
            <option value="">
              {t('admin.transactions.filter.statusAll')}
            </option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.toolbarField}>
          <label className={styles.toolbarLabel} htmlFor="tx-type">
            {t('admin.transactions.filter.typeLabel')}
          </label>
          <select
            id="tx-type"
            className={styles.toolbarSelect}
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
            data-testid="tx-type-filter"
          >
            <option value="">
              {t('admin.transactions.filter.typeAll')}
            </option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="secondary"
          onClick={handleClearFilters}
          disabled={!filtersActive}
          data-testid="tx-clear-filters"
        >
          <Filter size={14} aria-hidden />{' '}
          {t('admin.transactions.filter.clear')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void fetchPage(page)}
          disabled={isLoading}
          data-testid="tx-refresh"
          aria-label="Refresh"
        >
          <RefreshCw size={14} aria-hidden />
        </Button>
      </div>

      {error && (
        <ErrorBanner
          message={t('admin.transactions.error.load')}
          retry={
            <Button
              variant="primary"
              onClick={() => void fetchPage(page)}
              data-testid="tx-retry"
            >
              {t('admin.transactions.retry')}
            </Button>
          }
        />
      )}

      <div className={styles.tableCard}>
        {isLoading && rows.length === 0 ? (
          <div className={styles.emptyWrap}>
            <SkeletonRow count={5} rowHeight={36} />
          </div>
        ) : filteredRows.length === 0 ? (
          <div
            className={styles.emptyState}
            data-testid="tx-empty"
            role="status"
          >
            <strong>
              {t('admin.transactions.noTransactions')}
            </strong>
            {filtersActive && (
              <Button
                variant="secondary"
                onClick={handleClearFilters}
                data-testid="tx-empty-clear"
              >
                <X size={14} aria-hidden />{' '}
                {t('admin.transactions.filter.clear')}
              </Button>
            )}
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table
              className={styles.table}
              data-testid="tx-table"
            >
              <thead>
                <tr>
                  <th>{t('admin.transactions.transactionId')}</th>
                  <th>{t('admin.transactions.user')}</th>
                  <th>{t('admin.transactions.amount')}</th>
                  <th>{t('admin.transactions.status')}</th>
                  <th>{t('admin.transactions.type')}</th>
                  <th>{t('admin.transactions.descriptionColumn')}</th>
                  <th>{t('admin.transactions.plan')}</th>
                  <th>{t('admin.transactions.createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const userId = row.userId;
                  let userName: string;
                  if (userId == null) {
                    userName = t('admin.transactions.userUnknown');
                  } else {
                    const entry = userLookupCache.get(userId);
                    if (entry === false) {
                      userName = t(
                        'admin.transactions.userLookupFailed',
                        '',
                        { id: userId },
                      );
                    } else if (typeof entry === 'string') {
                      userName = entry;
                    } else if (entry && typeof entry === 'object') {
                      const u = entry as User;
                      userName =
                        u.fullName?.trim() ||
                        u.username?.trim() ||
                        u.email?.trim() ||
                        `User #${userId}`;
                    } else {
                      // not yet resolved (true = in flight, undefined = not started)
                      userName = `User #${userId}`;
                    }
                  }
                  const planId = row.annualFeeId;
                  let planName: string;
                  if (planId == null) {
                    planName = t('admin.transactions.planNone');
                  } else {
                    const entry = planLookupCache.get(planId);
                    if (entry === false) {
                      planName = `#${planId}`;
                    } else if (typeof entry === 'string') {
                      planName = entry;
                    } else if (entry && typeof entry === 'object') {
                      const plan = entry as AnnualFee;
                      planName = plan.name || `Plan #${planId}`;
                    } else {
                      planName = `#${planId}`;
                    }
                  }
                  return (
                    <tr
                      key={row.transactionId}
                      data-testid="tx-row"
                      data-tx-id={row.transactionId}
                    >
                      <td>
                        <span className={styles.txId}>
                          #{row.transactionId}
                        </span>
                      </td>
                      <td data-testid="tx-user-cell">{userName}</td>
                      <td>
                        <span
                          className={`${styles.amount} ${
                            row.status === 'Pending'
                              ? styles.amountPending
                              : ''
                          }`}
                        >
                          {formatVnd(row.amount)} VND
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.statusPill} ${statusPillClass(
                            row.status,
                          )}`}
                          data-testid="tx-status"
                        >
                          {row.status ?? '—'}
                        </span>
                      </td>
                      <td>{row.type ?? '—'}</td>
                      <td>
                        {row.description ?? row.paymentDescription ?? '—'}
                      </td>
                      <td>{planName}</td>
                      <td>{formatDateTime(row.createdAt, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isLoading && rows.length > 0 && (
          <div className={styles.loadingState}>
            <Loader
              size={14}
              className={styles.spinning}
              aria-hidden
            />{' '}
            …
          </div>
        )}

        <div
          className={styles.pagination}
          data-testid="tx-pagination"
          role="navigation"
          aria-label={t(
            'admin.transactions.pagination.page',
            '',
            { page, total: totalPages },
          )}
        >
          <span className={styles.paginationInfo}>
            {t(
              'admin.transactions.pagination.summary',
              '',
              { from: showingFrom, to: showingTo, total: totalCount },
            )}
          </span>
          <div className={styles.paginationActions}>
            <button
              type="button"
              className={styles.paginationBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              data-testid="tx-prev"
            >
              <ChevronLeft size={14} aria-hidden />{' '}
              {t('admin.transactions.pagination.prev')}
            </button>
            <span className={styles.paginationInfo}>
              {t(
                'admin.transactions.pagination.page',
                '',
                { page, total: totalPages },
              )}
            </span>
            <button
              type="button"
              className={styles.paginationBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              data-testid="tx-next"
            >
              {t('admin.transactions.pagination.next')}{' '}
              <ChevronRight size={14} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          className={styles.errorState}
          data-testid="tx-error"
          role="alert"
        >
          <AlertTriangle size={14} aria-hidden /> {error.message}
        </div>
      )}
    </div>
  );
};

export default TransactionsManagement;

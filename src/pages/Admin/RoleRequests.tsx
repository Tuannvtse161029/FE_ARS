/**
 * RoleRequests — ARS Research Constellation
 * Verification queue: list, filter, inspect pending/approved/rejected users.
 *
 * Agent 29/40 (BTR-AGENT29-A): the legacy `/api/RoleRequest` endpoint is no
 * longer authoritative. The Admin queue is now derived from the live
 * `/api/User` rows via `adminUserService`, filtered client-side by
 * `verificationStatus`. Accept / Reject mutations remain disabled until the
 * BE exposes a verification-mutation endpoint (BTR-AGENT29-C) — the buttons
 * are visually present with explanatory titles so the Admin can see why the
 * action is gated.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, Inbox, Search, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { usePagination } from '../../hooks/usePagination';
import { useTableSort } from '../../hooks/useTableSort';
import {
  adminUserService,
  isPendingVerification,
  normalizeVerificationStatus,
  type AdminVerificationStatus,
} from '../../services/adminUser.service';
import type { User } from '../../types/auth';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { SortableHeader } from '../../components/table/SortableHeader';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import VerificationDetailsModal from './VerificationDetailsModal';
import styles from './RoleRequests.module.css';

type StatusFilter = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/**
 * Sortable column identifiers for the Role Requests table.
 * Each id maps to a value extractor on the User row.
 */
type SortColumn =
  | 'name'
  | 'email'
  | 'role'
  | 'verification'
  | 'createdAt';

const STATUS_FILTERS: StatusFilter[] = ['PENDING', 'ACCEPTED', 'REJECTED'];

const ROLE_ACCENT = 'var(--ars-admin)';

const statusFilterToVerification = (
  filter: StatusFilter,
): AdminVerificationStatus | null => {
  switch (filter) {
    case 'PENDING':
      return 'Pending';
    case 'ACCEPTED':
      return 'Accepted';
    case 'REJECTED':
      return 'Rejected';
    default:
      return null;
  }
};

export const RoleRequests = () => {
  const { t } = useI18n();
  useAdminGuard();
  const [rows, setRows] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const VERIFICATION_STATUS_LABEL: Record<AdminVerificationStatus | 'UNKNOWN', string> = {
    Pending: t('common.status.pending'),
    Accepted: t('common.status.accepted'),
    Rejected: t('common.status.rejected'),
    UNKNOWN: t('common.status.unknown'),
  };

  const VERIFICATION_MUTATION_DISABLED_TITLE = t('admin.roleRequests.action.mutationDisabled');

  const formatRoleCell = (user: User): string => {
    const roleName = user.roleName?.trim();
    return roleName && roleName.length > 0 ? roleName : t('admin.roleRequests.table.pendingRole');
  };

  // Default to newest-created-first so a newly submitted request doesn't
  // disappear at the bottom of the queue. The user can override per column.
  const sort = useTableSort<User, SortColumn>('createdAt', 'desc');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminUserService.listAllUsers();
      setRows(data.rows);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('admin.roleRequests.error.tryAgain'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const verification = normalizeVerificationStatus(row.verificationStatus);
      const matchesStatus =
        status === 'PENDING'
          ? verification === 'Pending'
          : status === 'ACCEPTED'
          ? verification === 'Accepted'
          : status === 'REJECTED'
          ? verification === 'Rejected'
          : true;
      if (!matchesStatus) return false;
      if (!query) return true;
      const haystack = [
        row.fullName ?? '',
        row.email ?? '',
        row.username ?? '',
        String(row.id),
        row.roleName ?? '',
        row.accountTier ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, search, status]);

  // Apply the current sort on top of the filtered list. When no column is
  // active (cleared after two clicks), the default createdAt-desc order
  // takes over so newly created requests surface at the top.
  const sorted = useMemo(() => {
    return sort.sortedItemsBy(filtered, (row) => {
      switch (sort.sortState.column) {
        case 'name':
          return (row.fullName ?? row.username ?? '').toLowerCase();
        case 'email':
          return row.email ?? '';
        case 'role':
          return row.roleName ?? '';
        case 'verification':
          return normalizeVerificationStatus(row.verificationStatus) ?? '';
        case 'createdAt':
        default:
          return row.createdAt ?? null;
      }
    });
  }, [filtered, sort]);

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
  } = usePagination<User>(sorted, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, status, sort.sortState, resetPage]);

  const handleOpenDetails = (row: User) => {
    setSelected(row);
    setDetailsOpen(true);
  };

  const hasNoMatch =
    !loading &&
    !error &&
    totalItems === 0 &&
    (search.trim().length > 0 || status !== 'PENDING');

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={t('admin.roleRequests.eyebrow')}
        title={t('admin.roleRequests.title')}
        description={t('admin.roleRequests.description')}
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
        searchPlaceholder={t('admin.roleRequests.searchPlaceholder')}
        refreshLabel={t('admin.roleRequests.refresh')}
        filters={
          <>
            <span className={styles.filterIcon}>
              <Search size={14} aria-hidden />
            </span>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              aria-label="Filter by verification status"
              data-testid="role-requests-status-filter"
              disabled={Boolean(error)}
            >
              {STATUS_FILTERS.map((filterStatus) => (
                <option key={filterStatus} value={filterStatus}>
                  {filterStatus === 'PENDING'
                    ? t('common.status.pending')
                    : filterStatus === 'ACCEPTED'
                    ? t('common.status.approved')
                    : t('common.status.denied')}
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState} data-testid="role-requests-loading">
            <SkeletonRow count={8} rowHeight={36} withHeader />
          </div>
        ) : error ? (
          <div className={styles.errorWrap} data-testid="role-requests-error">
            <ErrorBanner
              tone="error"
              title={t('admin.roleRequests.error.loadFailed')}
              message={error}
              retry={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void load()}
                  disabled={loading || refreshing}
                >
                  {loading || refreshing ? t('admin.roleRequests.retrying') : t('admin.roleRequests.retry')}
                </Button>
              }
            />
          </div>
        ) : hasNoMatch ? (
          <EmptyState
            icon={<Inbox size={20} />}
            title={t('admin.roleRequests.empty.noMatchTitle')}
            description={t('admin.roleRequests.empty.noMatchDesc')
              .replace('{search}', search.trim())
              .replace('{status}', status !== 'PENDING' ? t('admin.roleRequests.empty.noMatchDescStatus').replace('{status}', t(`common.status.${status.toLowerCase()}`)) : '')}
          />
        ) : totalItems === 0 ? (
          <EmptyState
            icon={<Inbox size={20} />}
            title={t('admin.roleRequests.empty.noDataTitle').replace('{status}', t(`common.status.${status.toLowerCase()}`))}
            description={t('admin.roleRequests.empty.noDataDesc')}
          />
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>
                      <SortableHeader
                        column="name"
                        label={t('admin.roleRequests.table.user')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="role"
                        label={t('admin.roleRequests.table.role')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="email"
                        label={t('admin.roleRequests.table.email')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="verification"
                        label={t('admin.roleRequests.table.verificationStatus')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                        filterOptions={[
                          { value: 'ALL', label: t('admin.roleRequests.status.allStatuses') },
                          { value: 'PENDING', label: t('common.status.pending') },
                          { value: 'ACCEPTED', label: t('common.status.approved') },
                          { value: 'REJECTED', label: t('common.status.denied') },
                        ]}
                        activeFilter={status}
                        onFilterChange={(next) =>
                          setStatus(next as StatusFilter)
                        }
                      />
                    </th>
                    <th>{t('admin.roleRequests.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => {
                    const verification = normalizeVerificationStatus(row.verificationStatus);
                    const verificationLabel = verification
                      ? VERIFICATION_STATUS_LABEL[verification]
                      : VERIFICATION_STATUS_LABEL.UNKNOWN;
                    const pending = isPendingVerification(row);

                    return (
                      <tr key={row.id}>
                        <td>
                          <div className={styles.userCell}>
                            <span className={styles.userName}>
                              {row.fullName || row.username || '—'}
                            </span>
                            <span className={styles.userEmail}>
                              {row.email} · ID #{row.id}
                            </span>
                          </div>
                        </td>
                        <td>{formatRoleCell(row)}</td>
                        <td>
                          {row.isEmailVerified ? (
                            <span className={`${styles.statusPill} ${styles.statusAPPROVED}`}>
                              {t('admin.roleRequests.table.emailVerified')}
                            </span>
                          ) : (
                            <span className={`${styles.statusPill} ${styles.statusPENDING}`}>
                              {t('admin.roleRequests.table.emailNotVerified')}
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${
                              verification === 'Accepted'
                                ? styles.statusAPPROVED
                                : verification === 'Rejected'
                                ? styles.statusDENIED
                                : styles.statusPENDING
                            }`}
                          >
                            {verificationLabel}
                          </span>
                        </td>
                        <td>
                          <div className={styles.actions}>
                            <button
                              className={`${styles.actionButton} ${styles.inspectButton}`}
                              onClick={() => handleOpenDetails(row)}
                              type="button"
                              title={t('admin.roleRequests.action.viewDetailsTitle')}
                            >
                              <Eye size={14} />
                              {t('admin.roleRequests.action.viewDetails')}
                            </button>

                            {pending && (
                              <>
                                <button
                                  className={`${styles.actionButton} ${styles.approveButton}`}
                                  onClick={() => undefined}
                                  type="button"
                                  title={VERIFICATION_MUTATION_DISABLED_TITLE}
                                  data-testid="role-requests-accept"
                                  disabled
                                >
                                  <Check size={14} />
                                  {t('admin.roleRequests.action.accept')}
                                </button>
                                <button
                                  className={`${styles.actionButton} ${styles.denyButton}`}
                                  onClick={() => undefined}
                                  type="button"
                                  title={VERIFICATION_MUTATION_DISABLED_TITLE}
                                  data-testid="role-requests-reject"
                                  disabled
                                >
                                  <X size={14} />
                                  {t('admin.roleRequests.action.reject')}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              itemLabel={t('admin.roleRequests.itemLabel')}
            />
          </>
        )}
      </div>

      <VerificationDetailsModal
        user={selected}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />
    </div>
  );
};

// Internal helper retained for downstream imports; intentionally not exported
// from the public surface.
export const __statusFilterToVerification = statusFilterToVerification;

export default RoleRequests;
/**
 * RoleRequests — ARS Research Constellation
 * Verification queue: list, filter, inspect pending/approved/rejected role
 * requests. Drives the `/api/RoleRequest` endpoints that the BE exposes for
 * the Admin moderation surface.
 *
 * Lifecycle:
 *   The Admin loads the list from `adminService.getRoleRequests()` (live
 *   `/api/RoleRequest` GET). Pending rows show Accept / Reject buttons.
 *   Each action opens the existing `ApproveRoleRequestModal` /
 *   `DenyRoleRequestModal` (which already call `decideRoleRequest`) and
 *   refreshes the row in place. The action banner from the obsolete
 *   "verification mutation disabled" copy was removed once the BE endpoint
 *   (`/api/RoleRequest/{id}/approve` and `/deny`) is present in Swagger.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, Inbox, Search, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { usePagination } from '../../hooks/usePagination';
import { useTableSort } from '../../hooks/useTableSort';
import { adminService } from '../../services/admin.service';
import type { RoleRequest, RoleRequestStatus } from '../../types/admin';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { SortableHeader } from '../../components/table/SortableHeader';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import RoleRequestDetailsModal from './RoleRequestDetailsModal';
import ApproveRoleRequestModal from './ApproveRoleRequestModal';
import DenyRoleRequestModal from './DenyRoleRequestModal';
import styles from './RoleRequests.module.css';

type StatusFilter = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/**
 * Sortable column identifiers for the Role Requests table.
 *
 *   - `name`             : full name + ID — visual identity
 *   - `email`            : email address (sortable text)
 *   - `submittedAt`      : submission timestamp
 *   - `requestedRole`    : role the user is asking for
 *   - `requestType`      : initial registration vs additional role
 *   - `verification`     : overall verification decision (Pending / Accepted / Rejected)
 */
type SortColumn = 'name' | 'email' | 'submittedAt' | 'requestedRole' | 'requestType' | 'verification';

const STATUS_FILTERS: StatusFilter[] = ['PENDING', 'ACCEPTED', 'REJECTED'];

const ROLE_ACCENT = 'var(--ars-admin)';

const statusFilterToVerification = (
  filter: StatusFilter,
): RoleRequestStatus | null => {
  switch (filter) {
    case 'PENDING':
      return 'PENDING';
    case 'ACCEPTED':
      return 'APPROVED';
    case 'REJECTED':
      return 'DENIED';
    default:
      return null;
  }
};

const formatDateTime = (iso: string | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const RoleRequests = () => {
  const { t } = useI18n();
  useAdminGuard();
  const [rows, setRows] = useState<RoleRequest[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RoleRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);
  const [actingOn, setActingOn] = useState<RoleRequest | null>(null);

  const VERIFICATION_STATUS_LABEL: Record<RoleRequestStatus | 'UNKNOWN', string> = {
    PENDING: t('common.status.pending'),
    APPROVED: t('common.status.approved'),
    DENIED: t('common.status.denied'),
    UNKNOWN: t('common.status.unknown'),
  };

  const sort = useTableSort<RoleRequest, SortColumn>('submittedAt', 'desc');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminService.getRoleRequests();
      setRows(data);
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
      const matchesStatus =
        status === 'PENDING'
          ? row.status === 'PENDING'
          : status === 'ACCEPTED'
            ? row.status === 'APPROVED'
            : row.status === 'DENIED';
      if (!matchesStatus) return false;
      if (!query) return true;
      const haystack = [
        row.userName ?? '',
        row.email ?? '',
        row.phone ?? '',
        row.affiliation ?? '',
        row.department ?? '',
        String(row.id),
        String(row.userId),
        ...(row.currentRoles ?? []),
        ...(row.requestedAdditionalRoles ?? []),
        row.requestType ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, search, status]);

  // Apply the current sort on top of the filtered list. When no column is
  // active (cleared after two clicks), the default submittedAt-desc order
  // takes over so newly created requests surface at the top.
  const sorted = useMemo(() => {
    return sort.sortedItemsBy(filtered, (row) => {
      switch (sort.sortState.column) {
        case 'name':
          return (row.userName ?? '').toLowerCase();
        case 'email':
          return row.email ?? '';
        case 'submittedAt':
          return row.submissionDate ?? null;
        case 'requestedRole':
          return (row.requestedAdditionalRoles ?? []).join(', ');
        case 'requestType':
          return row.requestType ?? '';
        case 'verification':
          return row.status;
        default:
          return row.submissionDate ?? null;
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
  } = usePagination<RoleRequest>(sorted, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
    // Reset only when external filters / sort column changes — tracked at
    // the primitive level so the effect does NOT re-run on every render.
    // Including `resetPage` or `sort.sortState` (an object rebuilt by the
    // parent hook on each state change) would cause React to detect a
    // dependency change and re-run this effect on every render → infinite
    // loop. The eslint disable is intentional and documented.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, sort.sortState.column, sort.sortState.direction]);

  const handleOpenDetails = (row: RoleRequest) => {
    setSelected(row);
    setDetailsOpen(true);
  };

  // Replaces the previous role-request row in-place with the updated
  // record returned from `decideRoleRequest()`. Keeps the rest of the list
  // intact so other rows don't refetch.
  const handleActioned = useCallback((updated: RoleRequest) => {
    setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }, []);

  // Re-fetch everything after a successful decision (so the BE's
  // side-effects — notification fan-out, role assignment, audit trail —
  // surface even if the mutation response omitted any of those columns).
  const handleActionedWithReload = useCallback(async (updated: RoleRequest) => {
    handleActioned(updated);
    await load();
  }, [handleActioned, load]);

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

      {status === 'PENDING' && !loading && !error ? (
        <div
          className={styles.actionBanner}
          role="status"
          data-testid="role-requests-action-banner"
        >
          <span className={styles.actionBannerText}>
            {t(
              'admin.roleRequests.action.mutationEnabled',
              'Accept or Reject the request to update the user’s verification state.',
            )}
          </span>
        </div>
      ) : null}

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
                        column="email"
                        label={t('admin.roleRequests.table.emailAddress')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="requestedRole"
                        label={t('admin.roleRequests.table.requestedRole')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="requestType"
                        label={t('admin.roleRequests.table.requestType')}
                        cycleSort={sort.cycleSort}
                        ariaSortFor={sort.ariaSortFor}
                      />
                    </th>
                    <th>
                      <SortableHeader
                        column="submittedAt"
                        label={t('admin.roleRequests.table.submitted')}
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
                          { value: 'PENDING', label: t('common.status.pending') },
                          { value: 'ACCEPTED', label: t('common.status.approved') },
                          { value: 'REJECTED', label: t('common.status.denied') },
                        ]}
                        activeFilter={status}
                        onFilterChange={(next) => setStatus(next as StatusFilter)}
                      />
                    </th>
                    <th>{t('admin.roleRequests.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => {
                    const verificationLabel = VERIFICATION_STATUS_LABEL[row.status] ?? VERIFICATION_STATUS_LABEL.UNKNOWN;
                    const requestedRoles = row.requestedAdditionalRoles ?? [];
                    const isPending = row.status === 'PENDING';
                    const requestedRolesText = requestedRoles.length > 0
                      ? requestedRoles.join(', ')
                      : t('admin.roleRequests.details.none', '—');
                    const requestTypeLabel = row.requestType === 'INITIAL_REGISTRATION'
                      ? t('admin.roleRequests.details.initialRegistration', 'Initial registration')
                      : row.requestType === 'ADDITIONAL_ROLE'
                        ? t('admin.roleRequests.details.additionalRole', 'Additional role')
                        : t('admin.roleRequests.approve.unavailableApi', '—');
                    const isOrcidVerified = row.isOrcidVerified === true;

                    return (
                      <tr key={row.id}>
                        <td>
                          <div className={styles.userCell}>
                            <span className={styles.userName}>
                              {row.userName || '—'}
                            </span>
                            <span className={styles.userEmail}>
                              ID #{row.userId}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={styles.emailAddress}>
                            {row.email || '—'}
                          </span>
                        </td>
                        <td>
                          <span className={styles.roleCell}>
                            {requestedRolesText}
                          </span>
                        </td>
                        <td>
                          <span className={styles.roleCell}>
                            {requestTypeLabel}
                          </span>
                        </td>
                        <td>
                          <span className={styles.mono}>
                            {formatDateTime(row.submissionDate)}
                          </span>
                          {isOrcidVerified && row.orcidId ? (
                            <span
                              className={styles.orcidInline}
                              title={`ORCID ${row.orcidId}`}
                            >
                              <Check size={11} aria-hidden="true" /> ORCID
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${
                              row.status === 'APPROVED'
                                ? styles.statusAPPROVED
                                : row.status === 'DENIED'
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

                            {isPending && (
                              <>
                                <button
                                  className={`${styles.actionButton} ${styles.approveButton}`}
                                  onClick={() => {
                                    setActingOn(row);
                                    setApproveOpen(true);
                                  }}
                                  type="button"
                                  title={t(
                                    'admin.roleRequests.action.acceptTitle',
                                    'Accept and assign this role',
                                  )}
                                  data-testid="role-requests-accept"
                                >
                                  <Check size={14} />
                                  {t('admin.roleRequests.action.accept')}
                                </button>
                                <button
                                  className={`${styles.actionButton} ${styles.denyButton}`}
                                  onClick={() => {
                                    setActingOn(row);
                                    setDenyOpen(true);
                                  }}
                                  type="button"
                                  title={t(
                                    'admin.roleRequests.action.rejectTitle',
                                    'Reject this role request with a reason',
                                  )}
                                  data-testid="role-requests-reject"
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

      <RoleRequestDetailsModal
        request={selected}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />
      <ApproveRoleRequestModal
        request={actingOn}
        open={approveOpen}
        onClose={() => {
          setApproveOpen(false);
          setActingOn(null);
        }}
        onActioned={(updated) => void handleActionedWithReload(updated)}
      />
      <DenyRoleRequestModal
        request={actingOn}
        open={denyOpen}
        onClose={() => {
          setDenyOpen(false);
          setActingOn(null);
        }}
        onActioned={(updated) => void handleActionedWithReload(updated)}
      />
    </div>
  );
};

// Internal helper retained for downstream imports; intentionally not exported
// from the public surface.
export const __statusFilterToVerification = statusFilterToVerification;

export default RoleRequests;

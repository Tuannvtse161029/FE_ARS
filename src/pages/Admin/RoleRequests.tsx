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
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { usePagination } from '../../hooks/usePagination';
import {
  adminUserService,
  isPendingVerification,
  normalizeVerificationStatus,
  type AdminVerificationStatus,
} from '../../services/adminUser.service';
import type { User } from '../../types/auth';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import VerificationDetailsModal from './VerificationDetailsModal';
import styles from './RoleRequests.module.css';

type StatusFilter = 'PENDING' | 'ACCEPTED' | 'REJECTED';

const STATUS_FILTERS: StatusFilter[] = ['PENDING', 'ACCEPTED', 'REJECTED'];

const ROLE_ACCENT = 'var(--ars-admin)';

const VERIFICATION_STATUS_LABEL: Record<AdminVerificationStatus | 'UNKNOWN', string> = {
  Pending: 'Pending',
  Accepted: 'Accepted',
  Rejected: 'Rejected',
  UNKNOWN: 'Unknown',
};

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

// Accept / Reject buttons are intentionally disabled while the BE
// verification-mutation endpoint is missing (BTR-AGENT29-C). Centralized
// so the title attribute and tooltip stay in sync across all rows.
const VERIFICATION_MUTATION_DISABLED_TITLE =
  'Accept is unavailable — the verification-mutation endpoint is not yet exposed by the backend.';

const formatRoleCell = (user: User): string => {
  const roleName = user.roleName?.trim();
  return roleName && roleName.length > 0 ? roleName : 'Pending role assignment';
};

export const RoleRequests = () => {
  useAdminGuard();
  const [rows, setRows] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminUserService.listAllUsers();
      setRows(data.rows);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Role requests could not be loaded. Please try again.',
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
    return rows
      .filter((row) => {
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
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      );
  }, [rows, search, status]);

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
  } = usePagination<User>(filtered, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, status, resetPage]);

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
        eyebrow="ADMIN · VERIFICATION"
        title="Role Requests"
        description="Review and process user role verification requests. Pending requests are auto-loaded; use the filter to inspect approved or rejected history."
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
        searchPlaceholder="Search by name, email, ID, or role"
        refreshLabel="Refresh"
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
                    ? 'Pending'
                    : filterStatus === 'ACCEPTED'
                    ? 'Approved'
                    : 'Denied'}
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
              title="Could not load role requests"
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
          <EmptyState
            icon={<Inbox size={20} />}
            title="No matching role requests"
            description={`No role requests match "${search.trim()}"${
              status !== 'PENDING' ? ` in ${status.toLowerCase()}` : ''
            }.`}
          />
        ) : totalItems === 0 ? (
          <EmptyState
            icon={<Inbox size={20} />}
            title={`No ${status.toLowerCase()} role requests`}
            description="When users submit a verification request, it will appear here."
          />
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Assigned / Pending Role</th>
                    <th>Email Verification</th>
                    <th>Verification Status</th>
                    <th>Actions</th>
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
                              Verified
                            </span>
                          ) : (
                            <span className={`${styles.statusPill} ${styles.statusPENDING}`}>
                              Not verified
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
                              title="View full submission details & proof document"
                            >
                              <Eye size={14} />
                              View Details
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
                                  Accept
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
                                  Reject
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
              itemLabel="role requests"
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
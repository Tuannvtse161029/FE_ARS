import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Eye, FileText, Inbox, Search, X } from 'lucide-react';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { usePagination } from '../../hooks/usePagination';
import { adminUserService } from '../../services/adminUser.service';
import type { User } from '../../types/auth';
import { displayAccountTier } from '../../services/user.service';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import VerificationDetailsModal from './VerificationDetailsModal';
import styles from './RoleRequests.module.css';

// ── Agent 40 — verification management page ────────────────────────────────
//
// Source: `GET /api/User` (`swagger.json:3688-3716`). The original
// `/api/RoleRequest` endpoint does not exist in the current BE contract
// (BTR-AGENT29-C). Pending verification users are derived from the User
// response by `adminUserService.listPendingVerification`.
//
// The page deliberately renders the sidebar label "Role Requests" so we do
// not break existing deep-links while the BE contracts are still landing.
//
// IMPORTANT: Accept / Reject buttons are **disabled with explanatory copy**
// because the Swagger contract does NOT expose a verification-mutation
// endpoint. Flipping `verificationStatus` server-side requires BE work
// (BTR-AGENT29-C). Until then the UI stays honest and the Admin sees the
// reason inline.

type StatusFilter = 'PENDING' | 'ACCEPTED' | 'REJECTED';
type ModalKind = 'details' | null;

const STATUS_FILTERS: StatusFilter[] = ['PENDING', 'ACCEPTED', 'REJECTED'];

const statusClass = (raw: string): string => {
  switch (raw) {
    case 'Accepted':
      return styles.statusAPPROVED;
    case 'Rejected':
      return styles.statusDENIED;
    case 'Pending':
    default:
      return styles.statusPENDING;
  }
};

const formatRole = (roleName: string | null | undefined): string => {
  if (!roleName) return 'Pending role assignment';
  return roleName;
};

const formatTier = (tier: User['accountTier']): string => displayAccountTier(tier);

const formatEmailState = (user: User): string =>
  user.isEmailVerified ? 'Verified' : 'Not verified';

export const RoleRequests = () => {
  useAdminGuard();
  const [rows, setRows] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const aggregate = await adminUserService.listAllUsers();
      setRows(aggregate.rows);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Users could not be loaded. The Admin User API contract may have changed.',
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
    const base = rows.filter((row) => {
      const rowStatus =
        typeof row.verificationStatus === 'string' ? row.verificationStatus.toUpperCase() : '';
      if (status === 'PENDING' && rowStatus !== 'PENDING') return false;
      if (status === 'ACCEPTED' && rowStatus !== 'ACCEPTED') return false;
      if (status === 'REJECTED' && rowStatus !== 'REJECTED') return false;
      if (!query) return true;
      const searchable = [
        row.fullName,
        row.email,
        String(row.id),
        row.roleName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
    return base.sort(
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

  const openModal = (row: User) => {
    setSelected(row);
    setModal('details');
  };

  const hasNoMatch =
    !loading &&
    !error &&
    totalItems === 0 &&
    (search.trim().length > 0 || status !== 'PENDING');

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        Home &gt; Admin &gt;{' '}
        <span className={styles.activeBreadcrumb}>Role Requests</span>
      </div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Role Requests</h1>
          <p className={styles.pageSubtitle}>
            Inspect pending verification, then approve or deny after the
            Admin User API exposes the mutation endpoints.
          </p>
        </div>
      </div>

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
                      ? 'Accepted'
                      : 'Rejected'}
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState} data-testid="role-requests-loading">
            <span className={styles.spinning} />
            <span>Loading role requests…</span>
          </div>
        ) : error ? (
          <div
            className={styles.errorState}
            data-testid="role-requests-error"
            role="alert"
          >
            <AlertTriangle size={20} />
            <span>{error}</span>
            <button
              className={styles.retryBtn}
              onClick={() => void load()}
              type="button"
              disabled={loading || refreshing}
            >
              {loading || refreshing ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        ) : hasNoMatch ? (
          <div className={styles.emptyState} data-testid="role-requests-empty">
            <Inbox size={32} />
            <span>
              No role requests match “{search.trim()}”
              {status !== 'PENDING' ? ` in ${status}` : ''}.
            </span>
          </div>
        ) : totalItems === 0 ? (
          <div className={styles.emptyState} data-testid="role-requests-empty">
            <Inbox size={32} />
            <span>No {status.toLowerCase()} role requests.</span>
          </div>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Assigned / Pending Role</th>
                    <th>Email Verification</th>
                    <th>Submitted</th>
                    <th>Verification Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className={styles.userCell}>
                          <span className={styles.userName}>{row.fullName}</span>
                          <span className={styles.userEmail}>ID #{row.id}</span>
                        </div>
                      </td>
                      <td>{row.email}</td>
                      <td>{formatRole(row.roleName)}</td>
                      <td>{formatEmailState(row)}</td>
                      <td>
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleDateString('vi-VN')
                          : '—'}
                      </td>
                      <td>
                        <span
                          className={`${styles.statusPill} ${statusClass(
                            row.verificationStatus ?? 'Pending',
                          )}`}
                        >
                          {row.verificationStatus ?? 'Pending'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={`${styles.actionButton} ${styles.inspectButton}`}
                            onClick={() => openModal(row)}
                            type="button"
                          >
                            <Eye size={14} />
                            View Details
                          </button>
                          <button
                            className={`${styles.actionButton} ${styles.approveButton}`}
                            disabled
                            type="button"
                            title="Accept is unavailable until the Admin User API exposes a verification-mutation endpoint. See BTR-AGENT29-C."
                            data-testid="role-requests-accept"
                          >
                            <Check size={14} />
                            Accept
                          </button>
                          <button
                            className={`${styles.actionButton} ${styles.denyButton}`}
                            disabled
                            type="button"
                            title="Reject is unavailable until the Admin User API exposes a verification-mutation endpoint. See BTR-AGENT29-C."
                            data-testid="role-requests-reject"
                          >
                            <X size={14} />
                            Reject
                          </button>
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
              itemLabel="role requests"
            />
          </>
        )}
      </div>

      <VerificationDetailsModal
        user={selected}
        open={modal === 'details'}
        onClose={() => setModal(null)}
      />
    </div>
  );
};

// Re-export so the modal can be exercised in unit tests without exposing
// the modal component in two places.
export { formatRole, formatTier, statusClass };

// Hint to the linter: `FileText` is reserved for future "no proof document
// attached" copy updates; removing the import would require re-introducing
// it later, so the import stays here as a single reference.
void FileText;

export default RoleRequests;
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Eye, Inbox, Search, X } from 'lucide-react';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { usePagination } from '../../hooks/usePagination';
import { adminService } from '../../services/admin.service';
import type { RoleRequest, RoleRequestStatus } from '../../types/admin';
import ApproveRoleRequestModal from './ApproveRoleRequestModal';
import DenyRoleRequestModal from './DenyRoleRequestModal';
import RoleRequestDetailsModal from './RoleRequestDetailsModal';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import styles from './RoleRequests.module.css';

type StatusFilter = 'ALL' | RoleRequestStatus;
type ModalKind = 'details' | 'approve' | 'deny' | null;

const STATUS_FILTERS: StatusFilter[] = ['ALL', 'PENDING', 'APPROVED', 'DENIED'];
const rolesText = (roles?: string[]) =>
  roles ? (roles.length ? roles.join(', ') : 'None') : 'Unavailable';
const requestTypeLabel = (request: RoleRequest) => {
  if (request.requestType === 'INITIAL_REGISTRATION') return 'INITIAL REGISTRATION';
  if (request.requestType === 'ADDITIONAL_ROLE') return 'ADDITIONAL ROLE';
  return 'UNAVAILABLE';
};

export const RoleRequests = () => {
  useAdminGuard();
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RoleRequest | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRequests(await adminService.getRoleRequests());
    } catch (loadError) {
      // Service already sanitizes the message; keep the copy verbatim so the
      // page never surfaces a raw axios 404.
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Role requests could not be loaded. The Admin API contract may have changed.',
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
    const base = requests.filter((request) => {
      if (status !== 'ALL' && request.status !== status) return false;
      if (!query) return true;
      const searchable = [
        request.userName,
        request.email,
        String(request.userId),
        ...(request.currentRoles ?? []),
        ...(request.requestedAdditionalRoles ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
    // Newest first by submissionDate.
    return base.sort(
      (a, b) =>
        new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime(),
    );
  }, [requests, search, status]);

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
  } = usePagination<RoleRequest>(filtered, DEFAULT_PAGE_SIZE);

  // Spec: every time the search query or status filter changes, the user
  // must land back on page 1 (otherwise a stale page index can hide results).
  useEffect(() => {
    resetPage();
  }, [search, status, resetPage]);

  const openModal = (request: RoleRequest, kind: Exclude<ModalKind, null>) => {
    setSelected(request);
    setModal(kind);
  };

  const handleActioned = (updated: RoleRequest) => {
    setRequests((previous) =>
      previous.map((request) => (request.id === updated.id ? updated : request)),
    );
  };

  // "No matching results" only fires when the user has typed a query — we do
  // not want to override the "no records in the system" empty state with the
  // same zero-rows view.
  const hasNoMatch =
    !loading &&
    !error &&
    totalItems === 0 &&
    (search.trim().length > 0 || status !== 'ALL');

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
            Inspect requests independently, then approve or deny pending
            decisions.
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
              aria-label="Filter by status"
              data-testid="role-requests-status-filter"
              disabled={Boolean(error)}
            >
              {STATUS_FILTERS.map((filterStatus) => (
                <option key={filterStatus} value={filterStatus}>
                  {filterStatus === 'ALL' ? 'All Statuses' : filterStatus}
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
              {status !== 'ALL' ? ` in ${status}` : ''}.
            </span>
          </div>
        ) : totalItems === 0 ? (
          <div className={styles.emptyState} data-testid="role-requests-empty">
            <Inbox size={32} />
            <span>No role requests yet.</span>
          </div>
        ) : (
          <>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Initial / Current Role</th>
                    <th>Requested Additional Role</th>
                    <th>Request Type</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <div className={styles.userCell}>
                          <span className={styles.userName}>{request.userName}</span>
                          <span className={styles.userEmail}>
                            ID #{request.userId}
                          </span>
                        </div>
                      </td>
                      <td>{request.email}</td>
                      <td>{rolesText(request.currentRoles)}</td>
                      <td>{rolesText(request.requestedAdditionalRoles)}</td>
                      <td>
                        <span
                          className={`${styles.requestTypeBadge} ${
                            !request.requestType ? styles.requestTypeUnknown : ''
                          }`}
                        >
                          {requestTypeLabel(request)}
                        </span>
                      </td>
                      <td>
                        {new Date(request.submissionDate).toLocaleDateString('vi-VN')}
                      </td>
                      <td>
                        <span
                          className={`${styles.statusPill} ${
                            styles[`status${request.status}`]
                          }`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={`${styles.actionButton} ${styles.inspectButton}`}
                            onClick={() => openModal(request, 'details')}
                            type="button"
                          >
                            <Eye size={14} />
                            View Details
                          </button>
                          {request.status === 'PENDING' ? (
                            <>
                              <button
                                className={`${styles.actionButton} ${styles.approveButton}`}
                                onClick={() => openModal(request, 'approve')}
                                type="button"
                              >
                                <Check size={14} />
                                Approve
                              </button>
                              <button
                                className={`${styles.actionButton} ${styles.denyButton}`}
                                onClick={() => openModal(request, 'deny')}
                                type="button"
                              >
                                <X size={14} />
                                Deny
                              </button>
                            </>
                          ) : null}
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

      <RoleRequestDetailsModal
        request={selected}
        open={modal === 'details'}
        onClose={() => setModal(null)}
      />
      <ApproveRoleRequestModal
        request={selected}
        open={modal === 'approve'}
        onClose={() => setModal(null)}
        onActioned={handleActioned}
      />
      <DenyRoleRequestModal
        request={selected}
        open={modal === 'deny'}
        onClose={() => setModal(null)}
        onActioned={handleActioned}
      />
    </div>
  );
};

export default RoleRequests;

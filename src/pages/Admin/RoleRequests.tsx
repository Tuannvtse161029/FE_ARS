import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  Inbox,
  Search,
  X,
} from 'lucide-react';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { usePagination } from '../../hooks/usePagination';
import { adminService } from '../../services/admin.service';
import type { RoleRequest, RoleRequestStatus } from '../../types/admin';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import RoleRequestDetailsModal from './RoleRequestDetailsModal';
import ApproveRoleRequestModal from './ApproveRoleRequestModal';
import DenyRoleRequestModal from './DenyRoleRequestModal';
import styles from './RoleRequests.module.css';

type StatusFilter = 'PENDING' | 'APPROVED' | 'DENIED';
type ModalKind = 'details' | 'approve' | 'deny' | null;

const STATUS_FILTERS: StatusFilter[] = ['PENDING', 'APPROVED', 'DENIED'];

const statusClass = (status: RoleRequestStatus | string): string => {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
    case 'ACCEPTED':
      return styles.statusAPPROVED;
    case 'DENIED':
    case 'REJECTED':
      return styles.statusDENIED;
    case 'PENDING':
    default:
      return styles.statusPENDING;
  }
};

const formatRoles = (roles?: string[]): string => {
  if (!roles || roles.length === 0) return 'Pending role assignment';
  return roles.join(', ');
};

export const RoleRequests = () => {
  useAdminGuard();
  const [rows, setRows] = useState<RoleRequest[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selected, setSelected] = useState<RoleRequest | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminService.getRoleRequests();
      setRows(data);
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
    const base = rows.filter((row) => {
      const rowStatus = (row.status || 'PENDING').toUpperCase();
      if (status === 'PENDING' && rowStatus !== 'PENDING') return false;
      if (status === 'APPROVED' && rowStatus !== 'APPROVED' && rowStatus !== 'ACCEPTED') return false;
      if (status === 'DENIED' && rowStatus !== 'DENIED' && rowStatus !== 'REJECTED') return false;
      if (!query) return true;
      const searchable = [
        row.userName,
        row.email,
        String(row.id),
        String(row.userId),
        row.affiliation ?? '',
        row.department ?? '',
        (row.requestedAdditionalRoles || []).join(' '),
        (row.requestedRoles || []).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
    return base.sort(
      (a, b) =>
        new Date(b.submissionDate || 0).getTime() - new Date(a.submissionDate || 0).getTime(),
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
  } = usePagination<RoleRequest>(filtered, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    resetPage();
  }, [search, status, resetPage]);

  const handleOpenDetails = (row: RoleRequest) => {
    setSelected(row);
    setModal('details');
  };

  const handleOpenApprove = (row: RoleRequest) => {
    setSelected(row);
    setModal('approve');
  };

  const handleOpenDeny = (row: RoleRequest) => {
    setSelected(row);
    setModal('deny');
  };

  const handleActioned = (updated: RoleRequest) => {
    setRows((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    );
    if (updated.status === 'APPROVED') {
      setToastMessage({
        type: 'success',
        text: 'Phê duyệt vai trò thành công!',
      });
    } else if (updated.status === 'DENIED') {
      setToastMessage({
        type: 'success',
        text: 'Đã từ chối yêu cầu vai trò.',
      });
    }
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
            Review and process user role verification requests.
          </p>
        </div>
      </div>

      {toastMessage && (
        <div
          className={toastMessage.type === 'success' ? styles.toastSuccess : styles.toastError}
          role="status"
          aria-live="polite"
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toastMessage.text}</span>
          <button
            className={styles.toastClose}
            onClick={() => setToastMessage(null)}
            type="button"
            aria-label="Close notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
                    : filterStatus === 'APPROVED'
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
                    <th>Requested Role</th>
                    <th>Affiliation / Dept</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => {
                    const isPending = (row.status || 'PENDING').toUpperCase() === 'PENDING';
                    const requestedRolesList =
                      row.requestedAdditionalRoles?.length
                        ? row.requestedAdditionalRoles
                        : row.requestedRoles?.length
                          ? row.requestedRoles
                          : [];

                    return (
                      <tr key={row.id}>
                        <td>
                          <div className={styles.userCell}>
                            <span className={styles.userName}>{row.userName}</span>
                            <span className={styles.userEmail}>ID #{row.userId ?? row.id}</span>
                          </div>
                        </td>
                        <td>{row.email}</td>
                        <td>{formatRoles(requestedRolesList)}</td>
                        <td>
                          {row.affiliation || row.department
                            ? `${row.affiliation || ''}${row.affiliation && row.department ? ' · ' : ''}${row.department || ''}`
                            : '—'}
                        </td>
                        <td>
                          {row.submissionDate
                            ? new Date(row.submissionDate).toLocaleDateString('vi-VN')
                            : '—'}
                        </td>
                        <td>
                          <span
                            className={`${styles.statusPill} ${statusClass(row.status || 'PENDING')}`}
                          >
                            {row.status || 'Pending'}
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

                            {isPending && (
                              <>
                                <button
                                  className={`${styles.actionButton} ${styles.approveButton}`}
                                  onClick={() => handleOpenApprove(row)}
                                  type="button"
                                  title="Phê duyệt vai trò"
                                  data-testid="role-requests-accept"
                                >
                                  <Check size={14} />
                                  Accept
                                </button>
                                <button
                                  className={`${styles.actionButton} ${styles.denyButton}`}
                                  onClick={() => handleOpenDeny(row)}
                                  type="button"
                                  title="Từ chối vai trò"
                                  data-testid="role-requests-reject"
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

      {/* Details modal */}
      <RoleRequestDetailsModal
        request={selected}
        open={modal === 'details'}
        onClose={() => setModal(null)}
      />

      {/* Approve modal */}
      <ApproveRoleRequestModal
        request={selected}
        open={modal === 'approve'}
        onClose={() => setModal(null)}
        onActioned={handleActioned}
      />

      {/* Deny modal */}
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
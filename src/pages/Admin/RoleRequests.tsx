import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Eye, Inbox, RefreshCw, Search, X } from 'lucide-react';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { adminService } from '../../services/admin.service';
import type { RoleRequest, RoleRequestStatus } from '../../types/admin';
import ApproveRoleRequestModal from './ApproveRoleRequestModal';
import DenyRoleRequestModal from './DenyRoleRequestModal';
import RoleRequestDetailsModal from './RoleRequestDetailsModal';
import styles from './RoleRequests.module.css';

type StatusFilter = 'ALL' | RoleRequestStatus;
type ModalKind = 'details' | 'approve' | 'deny' | null;

const STATUS_FILTERS: StatusFilter[] = ['ALL', 'PENDING', 'APPROVED', 'DENIED'];
const rolesText = (roles?: string[]) => roles ? (roles.length ? roles.join(', ') : 'None') : 'Unavailable';
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
      setError(loadError instanceof Error ? loadError.message : 'Failed to load role requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (status !== 'ALL' && request.status !== status) return false;
      if (!query) return true;
      const searchable = [
        request.userName,
        request.email,
        String(request.userId),
        ...(request.currentRoles ?? []),
        ...(request.requestedAdditionalRoles ?? []),
      ].join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }, [requests, search, status]);

  const openModal = (request: RoleRequest, kind: Exclude<ModalKind, null>) => {
    setSelected(request);
    setModal(kind);
  };

  const handleActioned = (updated: RoleRequest) => {
    setRequests((previous) => previous.map((request) => request.id === updated.id ? updated : request));
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>Home &gt; Admin &gt; <span className={styles.activeBreadcrumb}>Role Requests</span></div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Role Requests</h1>
          <p className={styles.pageSubtitle}>Inspect requests independently, then approve or deny pending decisions.</p>
        </div>
        <button className={styles.viewBtn} onClick={() => { setRefreshing(true); void load(); }} disabled={refreshing} type="button">
          <RefreshCw size={13} className={refreshing ? styles.spinning : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className={styles.filterBar}>
        <Search size={16} className={styles.filterIcon} />
        <label className={styles.filterLabel} htmlFor="role-request-search">Search requests</label>
        <input id="role-request-search" className={styles.searchInput} placeholder="Name, email, ID, or role" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label className={styles.filterLabel} htmlFor="role-request-status">Status</label>
        <select id="role-request-status" className={styles.select} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          {STATUS_FILTERS.map((filterStatus) => <option key={filterStatus} value={filterStatus}>{filterStatus === 'ALL' ? 'All Statuses' : filterStatus}</option>)}
        </select>
      </div>

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}><RefreshCw size={20} className={styles.spinning} /><span>Loading role requests…</span></div>
        ) : error ? (
          <div className={styles.errorState}><AlertTriangle size={20} /><span>{error}</span><button className={styles.retryBtn} onClick={() => void load()} type="button">Retry</button></div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}><Inbox size={32} /><span>No role requests match the current filters.</span></div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead><tr><th>User</th><th>Email</th><th>Initial / Current Role</th><th>Requested Additional Role</th><th>Request Type</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((request) => (
                  <tr key={request.id}>
                    <td><div className={styles.userCell}><span className={styles.userName}>{request.userName}</span><span className={styles.userEmail}>ID #{request.userId}</span></div></td>
                    <td>{request.email}</td>
                    <td>{rolesText(request.currentRoles)}</td>
                    <td>{rolesText(request.requestedAdditionalRoles)}</td>
                    <td><span className={`${styles.requestTypeBadge} ${!request.requestType ? styles.requestTypeUnknown : ''}`}>{requestTypeLabel(request)}</span></td>
                    <td>{new Date(request.submissionDate).toLocaleDateString('vi-VN')}</td>
                    <td><span className={`${styles.statusPill} ${styles[`status${request.status}`]}`}>{request.status}</span></td>
                    <td>
                      <div className={styles.actions}>
                        <button className={`${styles.actionButton} ${styles.inspectButton}`} onClick={() => openModal(request, 'details')} type="button"><Eye size={14} />View Details</button>
                        {request.status === 'PENDING' ? (
                          <>
                            <button className={`${styles.actionButton} ${styles.approveButton}`} onClick={() => openModal(request, 'approve')} type="button"><Check size={14} />Approve</button>
                            <button className={`${styles.actionButton} ${styles.denyButton}`} onClick={() => openModal(request, 'deny')} type="button"><X size={14} />Deny</button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RoleRequestDetailsModal request={selected} open={modal === 'details'} onClose={() => setModal(null)} />
      <ApproveRoleRequestModal request={selected} open={modal === 'approve'} onClose={() => setModal(null)} onActioned={handleActioned} />
      <DenyRoleRequestModal request={selected} open={modal === 'deny'} onClose={() => setModal(null)} onActioned={handleActioned} />
    </div>
  );
};

export default RoleRequests;

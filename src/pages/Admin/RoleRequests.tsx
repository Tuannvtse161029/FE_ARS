import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, AlertTriangle, Inbox } from 'lucide-react';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { adminService } from '../../services/admin.service';
import type { RoleRequest, RoleRequestStatus } from '../../types/admin';
import RoleVerificationModal from './RoleVerificationModal';
import styles from './RoleRequests.module.css';

type StatusFilter = 'ALL' | RoleRequestStatus;

const STATUS_FILTERS: StatusFilter[] = ['ALL', 'PENDING', 'APPROVED', 'DENIED'];

export const RoleRequests = () => {
  useAdminGuard();

  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RoleRequest | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await adminService.getRoleRequests();
      setRequests(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load role requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (status !== 'ALL' && r.status !== status) return false;
      if (!q) return true;
      return (
        r.userName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        String(r.userId).includes(q) ||
        r.requestedRoles.some((role) => role.toLowerCase().includes(q))
      );
    });
  }, [requests, search, status]);

  const openModal = (r: RoleRequest) => {
    setSelected(r);
    setModalOpen(true);
  };

  const handleActioned = (updated: RoleRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        Home &gt; Admin &gt; <span className={styles.activeBreadcrumb}>Role Requests</span>
      </div>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Role Requests</h1>
          <p className={styles.pageSubtitle}>
            Review user-submitted role-upgrade requests and approve or deny them.
          </p>
        </div>
        <button
          className={styles.viewBtn}
          onClick={() => {
            setRefreshing(true);
            void load();
          }}
          disabled={refreshing}
          type="button"
        >
          <RefreshCw size={13} className={refreshing ? styles.spinning : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className={styles.filterBar}>
        <Search size={16} color="#94a3b8" />
        <input
          className={styles.searchInput}
          placeholder="Search by name, email, ID, or role"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All Statuses' : s}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>
            <RefreshCw size={20} className={styles.spinning} />
            <span>Loading role requests…</span>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <AlertTriangle size={20} color="#ef4444" />
            <span>{error}</span>
            <button className={styles.retryBtn} onClick={() => void load()}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <Inbox size={32} color="#94a3b8" />
            <span>No role requests match the current filters.</span>
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>USER</th>
                  <th>EMAIL</th>
                  <th>REQUESTED ROLES</th>
                  <th>SUBMITTED</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className={styles.userCell}>
                        <span className={styles.userName}>{r.userName}</span>
                        <span className={styles.userEmail}>ID #{r.userId}</span>
                      </div>
                    </td>
                    <td>{r.email}</td>
                    <td>
                      <div className={styles.rolesList}>
                        {r.requestedRoles.map((role) => (
                          <span key={role} className={styles.roleTag}>{role}</span>
                        ))}
                      </div>
                    </td>
                    <td>{new Date(r.submissionDate).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <span className={`${styles.statusPill} ${styles[`status${r.status}`]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className={styles.viewBtn}
                        onClick={() => openModal(r)}
                        type="button"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RoleVerificationModal
        request={selected}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onActioned={handleActioned}
      />
    </div>
  );
};

export default RoleRequests;

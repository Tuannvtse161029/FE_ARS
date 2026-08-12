import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authSlice';
import { ROUTES } from '../../routes/paths';
import styles from './AdminDashboard.module.css';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    if (user.roleName?.toLowerCase() !== 'admin') {
      navigate(ROUTES.FORUM, { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Admin</span>
      </div>

      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Admin Dashboard</h1>
        <p className={styles.pageSubtitle}>
          System administration and moderation tools.
        </p>
      </div>

      <div className={styles.placeholderCard}>
        <div className={styles.placeholderIcon}>{"\u{1F6E1}"}</div>
        <h2 className={styles.placeholderHeading}>Admin Console</h2>
        <p className={styles.placeholderBody}>
          Welcome{user?.fullName ? `, ${user.fullName}` : ''}. This is the admin landing area. The admin console is under construction.
        </p>
        <p className={styles.placeholderHint}>
          Future modules: user management, role approvals, platform statistics.
        </p>
      </div>
    </div>
  );
};

export default AdminDashboard;
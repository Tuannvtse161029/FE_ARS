import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/Button';
import styles from './Dashboard.module.css';

export const Dashboard = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.greeting}>
          Welcome back, <span className={styles.username}>{user?.username ?? 'User'}</span>
        </h1>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Log out
        </Button>
      </header>

      <main className={styles.content}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Dashboard</h2>
          <p className={styles.cardText}>Your session is active. More features coming soon.</p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

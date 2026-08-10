import { Outlet } from 'react-router-dom';
import styles from './AuthLayout.module.css';

export const AuthLayout = () => {
  return (
    <div className={styles.authLayout}>
      <div className={styles.authCard}>
        <div className={styles.leftPanel} />
        <div className={styles.rightPanel}>
          <div className={styles.formContainer}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;

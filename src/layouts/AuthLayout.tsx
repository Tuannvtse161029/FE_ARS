import { Outlet } from 'react-router-dom';
import styles from './AuthLayout.module.css';

export const AuthLayout = () => {
  return (
    <div className={styles.authLayout}>
      <div className={styles.leftPanel}>
        <div className={styles.leftPanelContent}>
          <div className={styles.logoContainer}>
            <img src="../assets/images/ARS_Logo.png" alt="ARS Platform Logo" className={styles.logo} />
          </div>
          <p className={styles.tagline}>
            Academic Research System
          </p>
        </div>
      </div>
      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;

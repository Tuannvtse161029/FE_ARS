import { Outlet } from 'react-router-dom';
import { useT } from '../i18n/I18nContext';
import styles from './AuthLayout.module.css';

export const AuthLayout = () => {
  const t = useT();
  return (
    <div className={styles.authLayout}>
      <div className={styles.authCard}>
        <div className={styles.leftPanel}>
          {/* Editorial masthead — a quiet, journal-cover-like composition
              that sits on top of the existing gradient overlay. Semantics:
              h2 (each auth page renders its own heading), decorative mono
              strings hidden from AT, the section named via aria-label. */}
          <header className={styles.masthead} aria-label={t('authLayout.mastheadLabel', 'ARS editorial masthead')}>
            <p className={styles.label} aria-hidden="true">
              {t('authLayout.mastheadLabel', 'ARS — Academic Research Sharing')}
            </p>
            <h2 className={styles.heading}>
              {t('authLayout.heading', 'Where research is read, written, and reviewed.')}
            </h2>
            <hr className={styles.rule} aria-hidden="true" />
            <p className={styles.caption}>
              {t('authLayout.caption', 'A working desk for researchers, reviewers, lecturers, and graduate students.')}
            </p>
          </header>
          <p className={styles.fieldList} aria-hidden="true">
            {t('authLayout.fields', 'Science · Humanities · Engineering · Medicine')}
          </p>
        </div>
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

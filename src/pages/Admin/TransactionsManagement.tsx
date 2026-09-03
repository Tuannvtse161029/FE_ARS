/**
 * TransactionsManagement — read-only placeholder.
 *
 * ARS no longer supports wallet top-up, withdrawal, or reviewer payouts.
 * This page now serves as an honest, read-only placeholder that explains
 * the change. See docs/WALLET_SCOPE_CHANGE.md for context.
 */
import { Banknote } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { PageHeader } from '../../components/PageHeader';
import styles from './TransactionsManagement.module.css';

const ROLE_ACCENT = 'var(--ars-admin)';

export const TransactionsManagement = () => {
  const { t } = useI18n();
  useAdminGuard();

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={t('admin.transactions.eyebrow')}
        title={t('admin.transactions.title')}
        description={t('admin.transactions.description')}
        accent={ROLE_ACCENT}
      />
      <div className={styles.tableCard}>
        <div
          className={styles.disabledNotice}
          data-testid="admin-transactions-unavailable"
          role="status"
        >
          <Banknote size={28} />
          <strong>{t('admin.transactions.plannedTitle')}</strong>
          <span>{t('admin.transactions.plannedMessage')}</span>
        </div>
      </div>
    </div>
  );
};

export default TransactionsManagement;

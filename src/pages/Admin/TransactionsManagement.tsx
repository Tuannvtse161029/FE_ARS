/**
 * TransactionsManagement — read-only placeholder.
 *
 * ARS no longer supports wallet top-up, withdrawal, or reviewer payouts.
 * This page now serves as an honest, read-only placeholder that explains
 * the change. See docs/WALLET_SCOPE_CHANGE.md for context.
 */
import { Banknote } from 'lucide-react';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { PageHeader } from '../../components/PageHeader';
import styles from './TransactionsManagement.module.css';

const ROLE_ACCENT = 'var(--ars-admin)';

const PLACEHOLDER_MESSAGE =
  'ARS credits and annual-fee support are planned for a future release. Top-up and withdrawal are not available on ARS.';

export const TransactionsManagement = () => {
  useAdminGuard();

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="ADMIN · TRANSACTIONS"
        title="Transactions"
        description="Read-only placeholder for the future ARS-credits area."
        accent={ROLE_ACCENT}
      />
      <div className={styles.tableCard}>
        <div
          className={styles.disabledNotice}
          data-testid="admin-transactions-unavailable"
          role="status"
        >
          <Banknote size={28} />
          <strong>Planned for a future release</strong>
          <span>{PLACEHOLDER_MESSAGE}</span>
        </div>
      </div>
    </div>
  );
};

export default TransactionsManagement;

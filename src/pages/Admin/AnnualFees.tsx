import { useCallback, useEffect, useState } from 'react';
import { annualFeeService } from '../../services/annualFee.service';
import type { AnnualFeeDto } from '../../types/annualFee';
import styles from './AnnualFees.module.css';

/**
 * Agent admin-annual-fees — Admin Annual Fees tab.
 *
 * Production Annual Fees surface. It never fabricates prices when the backend
 * contract is absent.
 */

const ROLE_LABEL: Record<string, string> = {
  Researcher: 'Researcher',
  Lecturer: 'Lecturer',
};

const formatCycle = (cycle: string | null): string => {
  if (cycle === 'Annual') return 'Annual (12 months)';
  if (cycle === 'SixMonth') return 'Six-month (6 months)';
  return '—';
};

const formatPrice = (priceVnd: number | null): string => {
  if (priceVnd === null) return '—';
  return `${priceVnd.toLocaleString('vi-VN')} VND`;
};

const AnnualFees = (): JSX.Element => {
  const [fees, setFees] = useState<AnnualFeeDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await annualFeeService.listAnnualFees();
      setFees(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to load annual fees.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={styles.page} aria-labelledby="annual-fees-heading">
      <header className={styles.pageHeader}>
        <div>
          <h1 id="annual-fees-heading" className={styles.title}>
            Annual Fees
          </h1>
          <p className={styles.subtitle}>
            Annual and six-month subscription tiers offered to each role.
          </p>
        </div>
      </header>

      {loading ? (
        <div className={styles.emptyState} role="status">
          Loading annual fees…
        </div>
      ) : error ? (
        <div className={styles.errorState} role="alert">
          Failed to load annual fees: {error}
        </div>
      ) : fees.length === 0 ? (
        <div className={styles.emptyState}>
          No annual fees configured yet.
        </div>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table} data-testid="annual-fees-table">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Plan</th>
                <th scope="col">Price</th>
                <th scope="col">Billing cycle</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => {
                const role = fee.targetRole ?? 'Unknown';
                const rowClass =
                  fee.isActive === false ? styles.inactive : '';
                return (
                  <tr
                    key={fee.id ?? `${role}-${fee.title ?? 'row'}`}
                    className={rowClass}
                    data-testid="annual-fees-row"
                    data-role={role}
                  >
                    <td>
                      <span className={styles.rolePill}>
                        {ROLE_LABEL[role] ?? role}
                      </span>
                    </td>
                    <td>{fee.title ?? '—'}</td>
                    <td>{formatPrice(fee.priceVnd)}</td>
                    <td>
                      <span className={styles.cycleBadge}>
                        {formatCycle(fee.billingCycle)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusPill} ${
                          fee.isActive
                            ? styles.statusActive
                            : styles.statusInactive
                        }`}
                      >
                        {fee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default AnnualFees;

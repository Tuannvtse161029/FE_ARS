import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader, RefreshCw } from 'lucide-react';
import { annualFeeService } from '../../services/annualFee.service';
import type { AnnualFeeDto } from '../../types/annualFee';
import styles from './AnnualFees.module.css';

const formatCycle = (cycle: string | null | undefined): string => {
  if (cycle === 'Annual') return 'Annual (12 months)';
  if (cycle === 'SixMonth') return 'Six-month (6 months)';
  return cycle ?? 'Not supplied';
};

const formatPrice = (priceVnd: number | null | undefined): string =>
  typeof priceVnd === 'number'
    ? `${priceVnd.toLocaleString('vi-VN')} VND`
    : 'Not supplied';

const AnnualFees = (): JSX.Element => {
  const [fees, setFees] = useState<AnnualFeeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setFees(await annualFeeService.listAnnualFees());
    } catch (loadError) {
      setFees([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Annual fees could not be loaded.',
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
            Annual Fees &amp; Subscriptions
          </h1>
          <p className={styles.subtitle}>
            Manage annual subscription fees offered to Researchers and Lecturers.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? styles.spinningIcon : undefined} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {loading ? (
        <div className={styles.emptyState} role="status">
          <Loader size={20} className={styles.spinningIcon} />
          <p>Loading annual fees...</p>
        </div>
      ) : error ? (
        <div className={styles.errorState} role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Annual Fees unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : fees.length === 0 ? (
        <div className={styles.emptyState}>No annual fee tiers are configured.</div>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table} data-testid="annual-fees-table">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Plan Title</th>
                <th scope="col">Price</th>
                <th scope="col">Billing Cycle</th>
                <th scope="col">Features</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.id} data-testid="annual-fees-row">
                  <td><span className={styles.rolePill}>{fee.targetRole}</span></td>
                  <td><strong>{fee.title}</strong></td>
                  <td>{formatPrice(fee.priceVnd)}</td>
                  <td><span className={styles.cycleBadge}>{formatCycle(fee.billingCycle)}</span></td>
                  <td>{fee.features?.join(', ') || 'Not supplied'}</td>
                  <td>{fee.isActive ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default AnnualFees;

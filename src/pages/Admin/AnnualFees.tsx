/**
 * AnnualFees — Admin annual-subscription management.
 *
 * The backend contract for `annualFeeService.listAnnualFees()` is not yet
 * exposed (per BTR-AGENT30-C). The page renders an honest unavailable state
 * when the API call fails OR returns zero rows, without fabricating sample
 * fee tiers. If the API later returns real data, it falls through to the
 * token-driven table view.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { annualFeeService } from '../../services/annualFee.service';
import type { AnnualFeeDto } from '../../types/annualFee';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import styles from './AnnualFees.module.css';

const ROLE_ACCENT = 'var(--ars-admin)';

const BACKEND_UNAVAILABLE_MESSAGE =
  'Annual fee tiers are unavailable until the backend exposes the annual-fee contract. The table below will populate automatically once the API is live.';

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
  useAdminGuard();

  const [fees, setFees] = useState<AnnualFeeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unavailable = error !== null || (!loading && fees.length === 0);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="ADMIN · ANNUAL FEES"
        title="Annual Fees & Subscriptions"
        description="Manage annual subscription fees offered to Researchers and Lecturers."
        accent={ROLE_ACCENT}
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setRefreshing(true);
              void load();
            }}
            disabled={loading}
            data-testid="annual-fees-refresh"
          >
            {loading || refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {loading ? (
        <div className={styles.tableCard}>
          <div className={styles.loadingState} role="status">
            <SkeletonRow count={6} rowHeight={28} withHeader />
          </div>
        </div>
      ) : unavailable ? (
        <div className={styles.tableCard}>
          <div
            className={styles.unavailableNotice}
            role="status"
            data-testid="annual-fees-unavailable"
          >
            <AlertTriangle size={26} aria-hidden />
            <strong>Backend contract unavailable</strong>
            <span>{BACKEND_UNAVAILABLE_MESSAGE}</span>
            {error ? <span>Reason: {error}</span> : null}
          </div>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableResponsive}>
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
                    <td>
                      <span className={styles.rolePill}>{fee.targetRole}</span>
                    </td>
                    <td>
                      <strong>{fee.title}</strong>
                    </td>
                    <td>{formatPrice(fee.priceVnd)}</td>
                    <td>
                      <span className={styles.cycleBadge}>
                        {formatCycle(fee.billingCycle)}
                      </span>
                    </td>
                    <td>
                      {fee.features?.join(', ') || 'Not supplied'}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default AnnualFees;
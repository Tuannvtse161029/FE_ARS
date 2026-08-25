import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { annualFeeService } from '../../services/annualFee.service';
import { ANNUAL_FEES_DEMO_NOTICE } from '../../data/annualFees.demo';
import type { AnnualFeeDto } from '../../types/annualFee';
import styles from './AnnualFees.module.css';

/**
 * Agent admin-annual-fees — Admin Annual Fees tab.
 *
 * The BE has not yet published the annual-fee CRUD endpoint (confirmed
 * against the live Swagger feed on 2026-08-25). Until the contract
 * lands, this tab renders against the dedicated demo-data module
 * (`src/data/annualFees.demo.ts`) and surfaces a prominent "Demo data
 * — awaiting backend API" banner so the Admin cannot mistake the
 * fixture values for live values.
 *
 * Two non-negotiable rules:
 *
 *   1. The demo values never flow into the production payment logic.
 *      This page is read-only UI; it never calls the payment service,
 *      the wallet debit endpoint, or the PayOS redirect.
 *
 *   2. The demo values are not scattered here. Every row is read
 *      through `annualFeeService.listAnnualFees()`, which itself
 *      short-circuits to the demo module. When the BE ships, only the
 *      service changes — this page does not need to.
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

      <div
        className={styles.demoBanner}
        role="status"
        aria-live="polite"
        data-testid="annual-fees-demo-banner"
      >
        <span className={styles.demoBannerIcon} aria-hidden="true">
          <AlertTriangle size={20} />
        </span>
        <span className={styles.demoBannerBody}>
          <span className={styles.demoBannerTitle}>{ANNUAL_FEES_DEMO_NOTICE}</span>
          <span className={styles.demoBannerSubtitle}>
            The annual-fee CRUD endpoint has not been published yet. Rows below are
            example fees for <strong>Researcher</strong> and <strong>Lecturer</strong>{' '}
            only — every value is isolated to the demo-data module and is never sent
            to the payment service.
          </span>
        </span>
      </div>

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
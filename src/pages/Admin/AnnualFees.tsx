/**
 * AnnualFees — Admin annual-subscription management.
 *
 * The backend contract for `annualFeeService.listAnnualFees()` is not yet
 * exposed (per BTR-AGENT30-C). The page renders an honest unavailable state
 * when the API call fails OR returns zero rows, without fabricating sample
 * fee tiers. If the API later returns real data, it falls through to the
 * token-driven table view.
 *
 * Features:
 *   - Search across plan title, role, and features
 *   - Sortable columns (title, price, role, status)
 *   - Default sort: newest first (by id)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { annualFeeService } from '../../services/annualFee.service';
import type { AnnualFeeDto } from '../../types/annualFee';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { useTableSort } from '../../hooks/useTableSort';
import { TableToolbar } from '../../components/table/TableToolbar';
import { SortableHeader } from '../../components/table/SortableHeader';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import styles from './AnnualFees.module.css';

const ROLE_ACCENT = 'var(--ars-admin)';

/** Sortable column ids for the Annual Fees table. */
type SortColumn = 'role' | 'title' | 'price' | 'billingCycle' | 'status';

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Default sort by id (newest first) so newly created fee tiers surface at top.
  const sort = useTableSort<AnnualFeeDto, SortColumn>('status', 'desc');

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

  // Filter by search term across title, role, and features.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? fees.filter((fee) => {
          const haystack = [
            fee.title ?? '',
            fee.targetRole ?? '',
            fee.billingCycle ?? '',
            (fee.features ?? []).join(' '),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(q);
        })
      : fees;
    if (statusFilter === 'ALL') return base;
    return base.filter((fee) =>
      statusFilter === 'ACTIVE' ? fee.isActive : !fee.isActive,
    );
  }, [fees, search, statusFilter]);

  // Apply column sort on top of filtered list.
  const sorted = useMemo(
    () =>
      sort.sortedItemsBy(filtered, (fee) => {
        switch (sort.sortState.column) {
          case 'role':
            return fee.targetRole ?? '';
          case 'title':
            return fee.title ?? '';
          case 'price':
            return fee.priceVnd ?? 0;
          case 'billingCycle':
            return fee.billingCycle ?? '';
          case 'status':
            return fee.isActive ? 1 : 0;
          default:
            return fee.id ?? null;
        }
      }),
    [filtered, sort],
  );

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

      <TableToolbar
        search={search}
        onSearchChange={error ? () => undefined : setSearch}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        isRefreshing={refreshing}
        searchPlaceholder="Search by role, plan title, or features…"
        refreshLabel="Refresh"
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
      ) : sorted.length === 0 ? (
        <div className={styles.tableCard}>
          <div
            className={styles.unavailableNotice}
            role="status"
            data-testid="annual-fees-empty"
          >
            <AlertTriangle size={26} aria-hidden />
            <strong>
              {search ? 'No matching fee plans' : 'No fee plans available'}
            </strong>
            <span>
              {search
                ? `No plans match "${search}". Try a different search term.`
                : 'Fee plans will appear here once the backend contract is live.'}
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableResponsive}>
            <table className={styles.table} data-testid="annual-fees-table">
              <thead>
                <tr>
                  <th>
                    <SortableHeader
                      column="role"
                      label="Role"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="title"
                      label="Plan Title"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="price"
                      label="Price"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                      align="right"
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="billingCycle"
                      label="Billing Cycle"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>Features</th>
                  <th>
                    <SortableHeader
                      column="status"
                      label="Status"
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                      filterOptions={[
                        { value: 'ALL', label: 'All statuses' },
                        { value: 'ACTIVE', label: 'Active' },
                        { value: 'INACTIVE', label: 'Inactive' },
                      ]}
                      activeFilter={statusFilter}
                      onFilterChange={(next) =>
                        setStatusFilter(
                          next as 'ALL' | 'ACTIVE' | 'INACTIVE',
                        )
                      }
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((fee) => (
                  <tr key={fee.id} data-testid="annual-fees-row">
                    <td>
                      <span className={styles.rolePill}>{fee.targetRole}</span>
                    </td>
                    <td>
                      <strong>{fee.title}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatPrice(fee.priceVnd)}
                    </td>
                    <td>
                      <span className={styles.cycleBadge}>
                        {formatCycle(fee.billingCycle)}
                      </span>
                    </td>
                    <td>{fee.features?.join(', ') || 'Not supplied'}</td>
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
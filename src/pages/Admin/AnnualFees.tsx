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
import { useI18n } from '../../i18n/I18nContext';
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

const AnnualFees = (): JSX.Element => {
  const { t } = useI18n();
  useAdminGuard();

  const BACKEND_UNAVAILABLE_MESSAGE = t('admin.annualFees.unavailableMessage');

  const formatCycle = (cycle: string | null | undefined): string => {
    if (cycle === 'Quarterly') return t('admin.annualFees.cycle.quarterly');
    if (cycle === 'Annual') return t('admin.annualFees.cycle.annual');
    if (cycle === 'SixMonth') return t('admin.annualFees.cycle.sixMonth');
    return cycle ?? t('admin.annualFees.notSupplied');
  };

  const formatPrice = (priceVnd: number | null | undefined): string =>
    typeof priceVnd === 'number'
      ? `${priceVnd.toLocaleString('vi-VN')} ${t('admin.annualFees.vnd')}`
      : t('admin.annualFees.notSupplied');

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
          : t('admin.annualFees.error.loadFailed'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

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
        eyebrow={t('admin.annualFees.eyebrow')}
        title={t('admin.annualFees.title')}
        description={t('admin.annualFees.description')}
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
            {loading || refreshing ? t('admin.annualFees.refreshing') : t('admin.annualFees.refresh')}
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
        searchPlaceholder={t('admin.annualFees.searchPlaceholder')}
        refreshLabel={t('admin.annualFees.refresh')}
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
            <strong>{t('admin.annualFees.unavailableTitle')}</strong>
            <span>{BACKEND_UNAVAILABLE_MESSAGE}</span>
            {error ? <span>{t('admin.annualFees.reason')}: {error}</span> : null}
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
              {search ? t('admin.annualFees.empty.noMatchTitle') : t('admin.annualFees.empty.noDataTitle')}
            </strong>
            <span>
              {search
                ? t('admin.annualFees.empty.noMatchDesc').replace('{search}', search)
                : t('admin.annualFees.empty.noDataDesc')}
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
                      label={t('admin.annualFees.table.role')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="title"
                      label={t('admin.annualFees.table.title')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="price"
                      label={t('admin.annualFees.table.price')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                      align="right"
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="billingCycle"
                      label={t('admin.annualFees.table.billingCycle')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th>
                    <SortableHeader
                      column="status"
                      label={t('admin.annualFees.table.status')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                      filterOptions={[
                        { value: 'ALL', label: t('admin.annualFees.status.allStatuses') },
                        { value: 'ACTIVE', label: t('admin.annualFees.status.active') },
                        { value: 'INACTIVE', label: t('admin.annualFees.status.inactive') },
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
                    <td>
                      <span
                        className={`${styles.statusPill} ${
                          fee.isActive
                            ? styles.statusActive
                            : styles.statusInactive
                        }`}
                      >
                        {fee.isActive ? t('admin.annualFees.status.active') : t('admin.annualFees.status.inactive')}
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
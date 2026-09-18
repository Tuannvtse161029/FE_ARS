/**
 * AdminGradingRubric — ARS Research Constellation
 * Admin surface for managing GradingRubric (scoring criteria) per SubField.
 *
 * Lists all SubFields via GET /api/SubField. Each row shows:
 *   SubField Name | Major Field | Criteria Count | Manage Rubric button
 *
 * Opening a row triggers GradingRubricModal which calls
 * PATCH /api/SubField/{id}/rubric on save.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { usePagination } from '../../hooks/usePagination';
import { useTableSort } from '../../hooks/useTableSort';
import { fieldService } from '../../services/field.service';
import type { SubFieldWithRubric } from '../../types/domain';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { SortableHeader } from '../../components/table/SortableHeader';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import GradingRubricModal from './GradingRubricModal';
import styles from './AdminGradingRubric.module.css';

type SortColumn = 'name' | 'majorFieldName' | 'criteriaCount';

export const AdminGradingRubric = () => {
  useAdminGuard();
  const { t } = useI18n();

  const [rows, setRows] = useState<SubFieldWithRubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalTarget, setModalTarget] = useState<SubFieldWithRubric | null>(null);

  const sort = useTableSort<SubFieldWithRubric, SortColumn>('name', 'asc');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fieldService.listSubFieldsWithRubric();
      setRows(data);
    } catch {
      setError(t('admin.rubric.error.loadFailed', 'Could not load sub-fields.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.majorFieldName.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    return sort.sortedItemsBy(filtered, (row) => {
      switch (sort.sortState.column) {
        case 'name':
          return row.name.toLowerCase();
        case 'majorFieldName':
          return row.majorFieldName.toLowerCase();
        case 'criteriaCount':
          return row.gradingRubric.length;
        default:
          return row.name.toLowerCase();
      }
    });
  }, [filtered, sort]);

  const {
    page,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    pageItems,
    prev,
    next,
    setPage,
  } = usePagination(sorted, DEFAULT_PAGE_SIZE);

  const handleManage = (row: SubFieldWithRubric) => {
    setModalTarget(row);
  };

  const handleModalSaved = (updatedRubric: SubFieldWithRubric['gradingRubric']) => {
    if (!modalTarget) return;
    setRows((prev) =>
      prev.map((r) =>
        r.subFieldId === modalTarget.subFieldId
          ? { ...r, gradingRubric: updatedRubric }
          : r,
      ),
    );
    setModalTarget(null);
  };

  const hasSearch = search.trim().length > 0;
  const isEmpty = !loading && !error && filtered.length === 0;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={t('admin.rubric.eyebrow', 'ADMIN — SUBFIELDS')}
        title={t('admin.rubric.title', 'GradingRubric Management')}
        description={t(
          'admin.rubric.description',
          'Update scoring criteria used by reviewers for each sub-field.',
        )}
      />

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => void load()}
        isRefreshing={loading}
        searchPlaceholder={t('admin.rubric.search', 'Search sub-fields\u2026')}
        refreshLabel={t('admin.rubric.refresh', 'Refresh')}
      />

      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loadingWrap}>
            <SkeletonRow count={6} rowHeight={36} withHeader />
          </div>
        ) : error ? (
          <div className={styles.errorWrap}>
            <ErrorBanner
              tone="error"
              title={t('admin.rubric.error.loadFailed', 'Could not load sub-fields.')}
              message={error}
              retry={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  {loading
                    ? t('admin.rubric.retrying', 'Retrying\u2026')
                    : t('admin.rubric.retry', 'Retry')}
                </Button>
              }
            />
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={<BookOpen size={32} />}
            title={
              hasSearch
                ? t('admin.rubric.empty.noMatch', 'No sub-fields match your search.')
                : t('admin.rubric.empty.title', 'No sub-fields found')
            }
            description={
              hasSearch
                ? undefined
                : t('admin.rubric.empty.desc', 'No sub-fields exist in the system.')
            }
          />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>
                    <SortableHeader
                      column="name"
                      label={t('admin.rubric.table.name', 'Sub-field')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th className={styles.th}>
                    <SortableHeader
                      column="majorFieldName"
                      label={t('admin.rubric.table.majorField', 'Major Field')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th className={styles.th}>
                    <SortableHeader
                      column="criteriaCount"
                      label={t('admin.rubric.table.criteriaCount', 'Criteria')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th className={styles.th}>
                    {t('admin.rubric.table.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row) => (
                  <tr key={row.subFieldId} className={styles.row}>
                    <td className={styles.td}>
                      <span className={styles.subFieldName}>{row.name}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.majorField}>{row.majorFieldName}</span>
                    </td>
                    <td className={styles.td}>
                      <span
                        className={
                          row.gradingRubric.length === 0
                            ? styles.countZero
                            : styles.count
                        }
                      >
                        {row.gradingRubric.length}
                        {' '}
                        {t('admin.rubric.criteria', 'criteria')}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={`${styles.actionButton} ${styles.manageButton}`}
                          onClick={() => handleManage(row)}
                          title={t('admin.rubric.action.manage', 'Manage Rubric')}
                        >
                          <BookOpen size={14} />
                          {t('admin.rubric.action.manage', 'Manage Rubric')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <TablePagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              startIndex={startIndex}
              endIndex={endIndex}
              onPrev={prev}
              onNext={next}
              onPage={setPage}
              itemLabel={t('admin.rubric.itemLabel', 'sub-fields')}
            />
          </>
        )}
      </div>

      {modalTarget && (
        <GradingRubricModal
          subFieldId={modalTarget.subFieldId}
          subFieldName={modalTarget.name}
          initialRubric={modalTarget.gradingRubric}
          open={!!modalTarget}
          onClose={() => setModalTarget(null)}
          onSaved={handleModalSaved}
        />
      )}
    </div>
  );
};

export default AdminGradingRubric;

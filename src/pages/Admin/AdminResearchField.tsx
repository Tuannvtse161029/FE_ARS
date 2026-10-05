/**
 * AdminResearchField — Single admin page that hosts the three CRUD
 * surfaces for the research taxonomy in a tabbed layout.
 *
 *   Tab 1: Major Field    (Create / Edit / Delete, with cascade guard)
 *   Tab 2: Sub Field      (Create / Edit / Delete, with cascade guard)
 *   Tab 3: Grading Rubic  (View + Edit rubric criteria per SubField)
 *
 * The active tab is reflected in `?tab=major|sub|gr`. URL is the source
 * of truth for direct visits; if no `?tab=` is present we fall back to
 * the last persisted value in localStorage (`ars_admin_research_field_tab`).
 *
 * Cascade rules (FE-side, pre-blocking):
 *
 *   - Major → Sub: deleting a major that still has sub-fields is blocked
 *     with a toast.error before any DELETE is sent. The count is read
 *     from the nested `subFields[]` returned by GET /api/MajorField (no
 *     extra round-trip).
 *
 *   - Sub → Rubric: deleting a sub-field that has any grading criteria
 *     attached is blocked with a toast.error. The rubric count is read
 *     from `fieldService.listSubFieldsWithRubric()` and cached in a ref
 *     so re-entering the Sub tab does not re-fetch.
 *
 * The BE is the source of truth for the actual delete: if the FE ever
 * misses a guard, the BE's 4xx response still surfaces via toast.error.
 *
 * Auto-switch on create: after a successful Create on the Major tab the
 * page switches to the Sub tab with the new major pre-selected as the
 * filter (`?tab=sub&major=<NEW_ID>`). This makes the priority order
 * (Major → Sub → Rubric) immediately actionable.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  FolderTree,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../../i18n/I18nContext';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { usePagination } from '../../hooks/usePagination';
import { useTableSort } from '../../hooks/useTableSort';
import { fieldService } from '../../services/field.service';
import type {
  MajorField,
  SubField,
  SubFieldWithRubric,
} from '../../types/domain';
import { TableToolbar } from '../../components/table/TableToolbar';
import { TablePagination } from '../../components/table/TablePagination';
import { SortableHeader } from '../../components/table/SortableHeader';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import { ConfirmModal } from '../../components/lecturer/ConfirmModal';
import { DEFAULT_PAGE_SIZE } from '../../utils/tableConstants';
import {
  ResearchFieldTabs,
  type ResearchFieldTabKey,
} from '../../components/admin/ResearchFieldTabs';
import MajorFieldFormModal from './MajorFieldFormModal';
import SubFieldFormModal from './SubFieldFormModal';
import GradingRubricModal from './GradingRubricModal';
import CreateSubFieldModal from './CreateSubFieldModal';
import EditSubFieldModal from './EditSubFieldModal';
import sharedStyles from './admin-table.module.css';
import filterStyles from './subfield-filter.module.css';
import styles from './AdminResearchField.module.css';

const ROLE_ACCENT = 'var(--ars-admin)';
const ALL_MAJORS_FILTER = 'all';
const TAB_STORAGE_KEY = 'ars_admin_research_field_tab';
const MAJOR_FILTER_QUERY = 'major';
const VALID_TABS: ResearchFieldTabKey[] = ['major', 'sub', 'gr'];

const isTabKey = (value: string | null): value is ResearchFieldTabKey =>
  value !== null && (VALID_TABS as string[]).includes(value);

const extractAxiosMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
};

type MajorSortColumn = 'name' | 'subFieldCount';
type SubSortColumn = 'name' | 'majorFieldName';
type GrSortColumn = 'name' | 'majorFieldName' | 'criteriaCount';

type DecoratedMajor = MajorField & { subFieldCount: number };
type DecoratedSub = SubField & { majorFieldName: string };

export const AdminResearchField = () => {
  useAdminGuard();
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Tab state (URL + localStorage) ─────────────────────────────────
  const queryTab = searchParams.get('tab');
  const initialTab: ResearchFieldTabKey = isTabKey(queryTab)
    ? queryTab
    : (() => {
        try {
          const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
          if (isTabKey(stored)) return stored;
        } catch {
          /* ignore */
        }
        return 'major';
      })();

  const [tab, setTabState] = useState<ResearchFieldTabKey>(initialTab);

  const setTab = useCallback(
    (next: ResearchFieldTabKey) => {
      setTabState(next);
      try {
        window.localStorage.setItem(TAB_STORAGE_KEY, next);
      } catch {
        /* ignore quota errors */
      }
      // Sync URL — preserve the `major` query param when moving to the
      // Sub tab so deep-links survive; clear it for the other tabs.
      const params: Record<string, string> = { tab: next };
      if (next === 'sub') {
        const major = searchParams.get(MAJOR_FILTER_QUERY);
        if (major) params[MAJOR_FILTER_QUERY] = major;
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <div className={sharedStyles.page} data-testid="admin-research-field-page">
      <PageHeader
        title={t('admin.researchField.title', 'Research Field')}
        description={t(
          'admin.researchField.description',
          'Manage research major fields, sub-fields, and grading rubrics in one place.',
        )}
        accent={ROLE_ACCENT}
      />
      <ResearchFieldTabs active={tab} onChange={setTab} />
      <div
        className={styles.tabPanel}
        role="tabpanel"
        id={`research-field-panel-${tab}`}
        aria-labelledby={`research-field-tab-${tab}`}
      >
        {tab === 'major' && <MajorFieldSurface />}
        {tab === 'sub' && <SubFieldSurface initialMajorFilter={searchParams.get(MAJOR_FILTER_QUERY) ?? ALL_MAJORS_FILTER} />}
        {tab === 'gr' && <GradingRubricSurface />}
      </div>
    </div>
  );
};

// ── Tab 1: Major Field ───────────────────────────────────────────────
const MajorFieldSurface = () => {
  const { t } = useI18n();
  const [rows, setRows] = useState<MajorField[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalTarget, setModalTarget] = useState<MajorField | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MajorField | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sort = useTableSort<DecoratedMajor, MajorSortColumn>('name', 'asc');

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      if (opts?.force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fieldService.getAllMajor();
        setRows(data);
      } catch (err) {
        const fallback = t(
          'admin.majorFields.error.loadFailed',
          'Could not load major fields.',
        );
        setError(extractAxiosMessage(err, fallback));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleDeleteClick = (row: MajorField) => {
    const count = row.subFields?.length ?? 0;
    if (count > 0) {
      // CASCADE BLOCK — pre-block the destructive action visibly.
      toast.error(
        t(
          'admin.researchField.cascade.toast.majorBlocked',
          'Cannot delete "{name}" — {count} sub-field{s} attached. Remove them first.',
          { name: row.name, count, s: count === 1 ? '' : 's' },
        ),
      );
      return;
    }
    setDeleteTarget(row);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await fieldService.deleteMajor(deleteTarget.id);
      toast.success(
        t(
          'admin.majorFields.toast.deleteSuccess',
          'Major field deleted successfully.',
        ),
      );
      setDeleteTarget(null);
      await load({ force: true });
    } catch (err) {
      toast.error(
        extractAxiosMessage(
          err,
          t(
            'admin.majorFields.toast.deleteError',
            'Failed to delete major field.',
          ),
        ),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const decorated = useMemo<DecoratedMajor[]>(
    () =>
      rows.map((row) => ({
        ...row,
        subFieldCount: row.subFields?.length ?? 0,
      })),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return decorated;
    return decorated.filter((row) => row.name.toLowerCase().includes(term));
  }, [decorated, search]);

  const sorted = useMemo(
    () =>
      sort.sortedItemsBy(filtered, (row) => {
        switch (sort.sortState.column) {
          case 'name':
            return row.name.toLowerCase();
          case 'subFieldCount':
            return row.subFieldCount;
          default:
            return row.name.toLowerCase();
        }
      }),
    [filtered, sort],
  );

  const {
    page,
    totalPages,
    startIndex,
    endIndex,
    pageItems,
    prev,
    next,
    setPage,
  } = usePagination(sorted, DEFAULT_PAGE_SIZE);

  const handleEdit = (row: MajorField) => {
    setModalMode('edit');
    setModalTarget(row);
  };

  const hasSearch = search.trim().length > 0;
  const isEmpty = !loading && !error && filtered.length === 0;

  return (
    <div data-testid="admin-major-fields-surface">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0' }}>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setCreateOpen(true)}
          data-testid="admin-major-fields-create"
        >
          {t('admin.majorFields.action.create', 'Create major field')}
        </Button>
      </div>

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => void load({ force: true })}
        isRefreshing={loading || refreshing}
        searchPlaceholder={t(
          'admin.majorFields.search',
          'Search major fields…',
        )}
        refreshLabel={
          loading || refreshing
            ? t('admin.majorFields.refreshing', 'Refreshing…')
            : t('admin.majorFields.refresh', 'Refresh')
        }
        filters={
          <div
            className={sharedStyles.searchWrap}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Search size={14} aria-hidden style={{ color: 'var(--ars-ink-muted)' }} />
            <span style={{ fontSize: 12, color: 'var(--ars-ink-muted)' }}>
              {t('admin.majorFields.count', '{count} major field{s}', {
                count: filtered.length.toLocaleString(),
                s: filtered.length === 1 ? '' : 's',
              })}
            </span>
          </div>
        }
      />

      <div className={sharedStyles.tableWrap}>
        {loading ? (
          <div className={sharedStyles.loadingWrap}>
            <SkeletonRow count={5} rowHeight={48} withHeader />
          </div>
        ) : error ? (
          <div className={sharedStyles.errorWrap}>
            <ErrorBanner
              tone="error"
              title={t(
                'admin.majorFields.errorTitle',
                'Could not load major fields',
              )}
              message={error}
              retry={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void load({ force: true })}
                  disabled={loading}
                >
                  {loading
                    ? t('common.retrying', 'Retrying…')
                    : t('common.retry', 'Retry')}
                </Button>
              }
            />
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={<FolderTree size={32} />}
            title={
              hasSearch
                ? t(
                    'admin.majorFields.empty.noMatch',
                    'No major fields match your search',
                  )
                : t('admin.majorFields.empty.title', 'No major fields yet')
            }
            description={
              hasSearch
                ? t(
                    'admin.majorFields.empty.noMatchDesc',
                    'Try a different keyword, or clear the search to see all major fields.',
                  )
                : t(
                    'admin.majorFields.empty.desc',
                    'Create the first major field to start organizing research taxonomy on the platform.',
                  )
            }
            action={
              hasSearch
                ? undefined
                : (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() => setCreateOpen(true)}
                  >
                    {t('admin.majorFields.action.create', 'Create major field')}
                  </Button>
                )
            }
          />
        ) : (
          <table className={sharedStyles.table} data-testid="admin-major-fields-table">
            <thead>
              <tr>
                <SortableHeader
                  label={t('admin.majorFields.column.name', 'Name')}
                  column="name"
                  cycleSort={sort.cycleSort}
                  ariaSortFor={sort.ariaSortFor}
                  className={sharedStyles.th}
                />
                <th className={sharedStyles.th}>
                  {t('admin.majorFields.column.description', 'Description')}
                </th>
                <SortableHeader
                  label={t('admin.majorFields.column.subFieldCount', 'Sub-fields')}
                  column="subFieldCount"
                  cycleSort={sort.cycleSort}
                  ariaSortFor={sort.ariaSortFor}
                  className={sharedStyles.th}
                />
                <th className={sharedStyles.th} style={{ textAlign: 'right' }}>
                  {t('admin.majorFields.column.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr
                  key={row.id}
                  className={sharedStyles.row}
                  data-testid={`admin-major-fields-row-${row.id}`}
                >
                  <td className={sharedStyles.td}>
                    <span className={sharedStyles.subFieldName}>{row.name}</span>
                  </td>
                  <td className={sharedStyles.td}>
                    {row.description ? (
                      <span style={{ color: 'var(--ars-ink-soft)' }}>
                        {row.description}
                      </span>
                    ) : (
                      <span
                        style={{
                          color: 'var(--ars-ink-muted)',
                          fontStyle: 'italic',
                        }}
                      >
                        {t('admin.majorFields.noDescription', 'No description')}
                      </span>
                    )}
                  </td>
                  <td className={sharedStyles.td}>
                    {row.subFieldCount > 0 ? (
                      <span
                        className={sharedStyles.count}
                        data-testid={`major-subfield-count-${row.id}`}
                      >
                        {row.subFieldCount.toLocaleString()}
                      </span>
                    ) : (
                      <span className={sharedStyles.countZero}>0</span>
                    )}
                  </td>
                  <td className={sharedStyles.td} style={{ textAlign: 'right' }}>
                    <div className={sharedStyles.actions}>
                      <button
                        type="button"
                        className={`${sharedStyles.actionButton} ${sharedStyles.editButton}`}
                        onClick={() => handleEdit(row)}
                        data-testid={`admin-major-fields-edit-${row.id}`}
                        title={t('admin.majorFields.action.edit', 'Edit')}
                      >
                        <Pencil size={13} aria-hidden />
                        {t('admin.majorFields.action.editShort', 'Edit')}
                      </button>
                      <button
                        type="button"
                        className={`${sharedStyles.actionButton} ${sharedStyles.deleteButton}`}
                        onClick={() => handleDeleteClick(row)}
                        data-testid={`admin-major-fields-delete-${row.id}`}
                        title={t('admin.majorFields.action.delete', 'Delete')}
                      >
                        <Trash2 size={13} aria-hidden />
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && filtered.length > 0 && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalItems={sorted.length}
          startIndex={startIndex}
          endIndex={endIndex}
          onPrev={prev}
          onNext={next}
          onPage={setPage}
        />
      )}

      <MajorFieldFormModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSuccess={() => void load({ force: true })}
      />
      <MajorFieldFormModal
        open={modalMode === 'edit' && modalTarget !== null}
        mode={modalMode}
        target={modalTarget}
        onClose={() => setModalTarget(null)}
        onSuccess={() => void load({ force: true })}
      />

      {deleteTarget && (
        <ConfirmModal
          open={!!deleteTarget}
          title={t('admin.majorFields.deleteModal.title', 'Delete major field')}
          description={t(
            'admin.majorFields.deleteModal.desc',
            'Are you sure you want to delete "{name}"? This action cannot be undone.',
            { name: deleteTarget.name },
          )}
          variant="destructive"
          confirmLabel={
            isDeleting
              ? t('common.deleting', 'Deleting…')
              : t('common.delete', 'Delete')
          }
          cancelLabel={t('common.cancel', 'Cancel')}
          onConfirm={() => void handleConfirmDelete()}
          onClose={() => {
            if (!isDeleting) setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
};

// ── Tab 2: Sub Field ────────────────────────────────────────────────
const SubFieldSurface = ({ initialMajorFilter }: { initialMajorFilter: string }) => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<SubField[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [majors, setMajors] = useState<MajorField[]>([]);
  const [majorFilter, setMajorFilter] = useState<string>(
    initialMajorFilter && initialMajorFilter !== ALL_MAJORS_FILTER
      ? initialMajorFilter
      : ALL_MAJORS_FILTER,
  );

  const [modalTarget, setModalTarget] = useState<SubField | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SubField | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sort = useTableSort<DecoratedSub, SubSortColumn>('name', 'asc');

  // Rubric map — populated by `listSubFieldsWithRubric` and used for
  // the Sub → Rubric cascade block. Cached in a ref so re-mounting the
  // Sub tab does not re-fetch.
  const rubricBySubFieldId = useRef<Map<number, number>>(new Map());
  const rubricLoaded = useRef(false);
  const [rubricReady, setRubricReady] = useState(false);

  // Load majors once for the filter dropdown.
  useEffect(() => {
    let active = true;
    fieldService
      .getAllMajor()
      .then((data) => {
        if (active) setMajors(data);
      })
      .catch(() => {
        if (active) {
          toast.warning(
            t(
              'admin.subFields.error.loadMajorsFailedSilent',
              'Could not load major fields. Filter is disabled, but you can still browse all sub-fields.',
            ),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [t]);

  // Load rubric data once (for the cascade block) — cached across
  // re-mounts of the Sub tab via the ref.
  useEffect(() => {
    if (rubricLoaded.current) {
      setRubricReady(true);
      return;
    }
    let active = true;
    fieldService
      .listSubFieldsWithRubric()
      .then((data) => {
        if (!active) return;
        const map = new Map<number, number>();
        for (const r of data) {
          map.set(r.subFieldId, r.gradingRubric.length);
        }
        rubricBySubFieldId.current = map;
        rubricLoaded.current = true;
        setRubricReady(true);
      })
      .catch(() => {
        if (active) {
          // Non-fatal: cascade guard just degrades to "BE error message"
          // if the admin ever clicks Delete on a sub-field with a
          // rubric.
          setRubricReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const majorNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of majors) map.set(m.id, m.name);
    return map;
  }, [majors]);

  const getFilterMajorId = (): number | null => {
    if (majorFilter === ALL_MAJORS_FILTER) return null;
    const parsed = Number(majorFilter);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const load = useCallback(
    async (opts?: { force?: boolean; majorId?: number | null }) => {
      if (opts?.force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const filterId =
          opts && opts.majorId != null ? opts.majorId : undefined;
        const data = await fieldService.getAllSub(filterId);
        setRows(data);
      } catch (err) {
        const fallback = t(
          'admin.subFields.error.loadFailed',
          'Could not load sub-fields.',
        );
        setError(extractAxiosMessage(err, fallback));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (majorFilter === ALL_MAJORS_FILTER) {
      void load({ majorId: null });
    } else {
      const parsed = Number(majorFilter);
      if (Number.isFinite(parsed) && parsed > 0) {
        void load({ majorId: parsed });
      }
    }
  }, [majorFilter, load]);

  // Sync the major filter back into the URL so it survives a refresh
  // and is shareable. Cleared on the other tabs.
  useEffect(() => {
    const current = searchParams.get(MAJOR_FILTER_QUERY);
    const desired =
      majorFilter === ALL_MAJORS_FILTER ? null : majorFilter;
    if (current === desired) return;
    const next: Record<string, string> = { tab: 'sub' };
    if (desired) next[MAJOR_FILTER_QUERY] = desired;
    setSearchParams(next, { replace: true });
  }, [majorFilter, searchParams, setSearchParams]);

  const handleDeleteClick = async (row: SubField) => {
    // CASCADE BLOCK — Sub → Rubric. If the rubric map is already
    // loaded, check synchronously; otherwise fetch and re-check.
    const check = (): number | undefined => {
      const cached = rubricBySubFieldId.current.get(row.id);
      if (cached !== undefined) return cached;
      return undefined;
    };
    let count = check();
    if (count === undefined && !rubricReady) {
      try {
        const data = await fieldService.listSubFieldsWithRubric();
        const map = new Map<number, number>();
        for (const r of data) map.set(r.subFieldId, r.gradingRubric.length);
        rubricBySubFieldId.current = map;
        rubricLoaded.current = true;
        setRubricReady(true);
        count = map.get(row.id) ?? 0;
      } catch {
        count = 0;
      }
    }
    if ((count ?? 0) > 0) {
      toast.error(
        t(
          'admin.researchField.cascade.toast.subBlocked',
          'Cannot delete "{name}" — a grading rubric is attached. Remove it from the Grading Rubic tab first.',
          { name: row.name },
        ),
      );
      return;
    }
    setDeleteTarget(row);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await fieldService.deleteSub(deleteTarget.id);
      toast.success(
        t(
          'admin.subFields.toast.deleteSuccess',
          'Sub-field deleted successfully.',
        ),
      );
      setDeleteTarget(null);
      await load({ force: true, majorId: getFilterMajorId() });
    } catch (err) {
      toast.error(
        extractAxiosMessage(
          err,
          t('admin.subFields.toast.deleteError', 'Failed to delete sub-field.'),
        ),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const decorated = useMemo<DecoratedSub[]>(
    () =>
      rows.map((row) => ({
        ...row,
        majorFieldName: majorNameById.get(row.majorFieldId) ?? '—',
      })),
    [rows, majorNameById],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return decorated;
    return decorated.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.majorFieldName.toLowerCase().includes(term),
    );
  }, [decorated, search]);

  const sorted = useMemo(
    () =>
      sort.sortedItemsBy(filtered, (row) => {
        switch (sort.sortState.column) {
          case 'name':
            return row.name.toLowerCase();
          case 'majorFieldName':
            return row.majorFieldName.toLowerCase();
          default:
            return row.name.toLowerCase();
        }
      }),
    [filtered, sort],
  );

  const {
    page,
    totalPages,
    startIndex,
    endIndex,
    pageItems,
    prev,
    next,
    setPage,
  } = usePagination(sorted, DEFAULT_PAGE_SIZE);

  const handleEdit = (row: SubField) => {
    setModalMode('edit');
    setModalTarget(row);
  };

  const hasSearch = search.trim().length > 0;
  const isEmpty = !loading && !error && filtered.length === 0;
  const filterDisabled = majors.length === 0;

  return (
    <div data-testid="admin-sub-fields-surface">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0' }}>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setCreateOpen(true)}
          data-testid="admin-sub-fields-create"
        >
          {t('admin.subFields.action.create', 'Create sub-field')}
        </Button>
      </div>

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => void load({ force: true, majorId: getFilterMajorId() })}
        isRefreshing={loading || refreshing}
        searchPlaceholder={t('admin.subFields.search', 'Search sub-fields…')}
        refreshLabel={
          loading || refreshing
            ? t('admin.subFields.refreshing', 'Refreshing…')
            : t('admin.subFields.refresh', 'Refresh')
        }
        filters={
          <label className={filterStyles.filterRow}>
            <span className={filterStyles.filterLabel}>
              {t('admin.subFields.filter.major', 'Major field')}
            </span>
            <select
              className={filterStyles.filterSelect}
              value={majorFilter}
              onChange={(event) => setMajorFilter(event.target.value)}
              disabled={filterDisabled}
              data-testid="admin-sub-fields-major-filter"
            >
              <option value={ALL_MAJORS_FILTER}>
                {t('admin.subFields.filter.all', 'All major fields')}
              </option>
              {majors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <span className={filterStyles.filterCount}>
              {t('admin.subFields.count', '{count} sub-field{s}', {
                count: filtered.length.toLocaleString(),
                s: filtered.length === 1 ? '' : 's',
              })}
            </span>
          </label>
        }
      />

      <div className={sharedStyles.tableWrap}>
        {loading ? (
          <div className={sharedStyles.loadingWrap}>
            <SkeletonRow count={5} rowHeight={48} withHeader />
          </div>
        ) : error ? (
          <div className={sharedStyles.errorWrap}>
            <ErrorBanner
              tone="error"
              title={t('admin.subFields.errorTitle', 'Could not load sub-fields')}
              message={error}
              retry={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void load({ force: true })}
                  disabled={loading}
                >
                  {loading
                    ? t('common.retrying', 'Retrying…')
                    : t('common.retry', 'Retry')}
                </Button>
              }
            />
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={<Tag size={32} />}
            title={
              hasSearch
                ? t('admin.subFields.empty.noMatch', 'No sub-fields match your search')
                : majorFilter !== ALL_MAJORS_FILTER
                  ? t('admin.subFields.empty.noMatchFilter', 'No sub-fields in this major field')
                  : t('admin.subFields.empty.title', 'No sub-fields yet')
            }
            description={
              hasSearch
                ? t(
                    'admin.subFields.empty.noMatchDesc',
                    'Try a different keyword, or clear the search to see all sub-fields.',
                  )
                : t(
                    'admin.subFields.empty.desc',
                    'Create the first sub-field under any major field to start organizing research taxonomy.',
                  )
            }
            action={
              hasSearch
                ? undefined
                : (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() => setCreateOpen(true)}
                  >
                    {t('admin.subFields.action.create', 'Create sub-field')}
                  </Button>
                )
            }
          />
        ) : (
          <table className={sharedStyles.table} data-testid="admin-sub-fields-table">
            <thead>
              <tr>
                <SortableHeader
                  label={t('admin.subFields.column.name', 'Name')}
                  column="name"
                  cycleSort={sort.cycleSort}
                  ariaSortFor={sort.ariaSortFor}
                  className={sharedStyles.th}
                />
                <SortableHeader
                  label={t('admin.subFields.column.majorField', 'Major field')}
                  column="majorFieldName"
                  cycleSort={sort.cycleSort}
                  ariaSortFor={sort.ariaSortFor}
                  className={sharedStyles.th}
                />
                <th className={sharedStyles.th}>
                  {t('admin.subFields.column.description', 'Description')}
                </th>
                <th className={sharedStyles.th} style={{ textAlign: 'right' }}>
                  {t('admin.subFields.column.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr
                  key={row.id}
                  className={sharedStyles.row}
                  data-testid={`admin-sub-fields-row-${row.id}`}
                >
                  <td className={sharedStyles.td}>
                    <span className={sharedStyles.subFieldName}>{row.name}</span>
                  </td>
                  <td className={sharedStyles.td}>
                    <span className={sharedStyles.majorField}>{row.majorFieldName}</span>
                  </td>
                  <td className={sharedStyles.td}>
                    {row.description ? (
                      <span style={{ color: 'var(--ars-ink-soft)' }}>
                        {row.description}
                      </span>
                    ) : (
                      <span
                        style={{
                          color: 'var(--ars-ink-muted)',
                          fontStyle: 'italic',
                        }}
                      >
                        {t('admin.subFields.noDescription', 'No description')}
                      </span>
                    )}
                  </td>
                  <td className={sharedStyles.td} style={{ textAlign: 'right' }}>
                    <div className={sharedStyles.actions}>
                      <button
                        type="button"
                        className={`${sharedStyles.actionButton} ${sharedStyles.editButton}`}
                        onClick={() => handleEdit(row)}
                        data-testid={`admin-sub-fields-edit-${row.id}`}
                        title={t('admin.subFields.action.edit', 'Edit')}
                      >
                        <Pencil size={13} aria-hidden />
                        {t('admin.subFields.action.editShort', 'Edit')}
                      </button>
                      <button
                        type="button"
                        className={`${sharedStyles.actionButton} ${sharedStyles.deleteButton}`}
                        onClick={() => void handleDeleteClick(row)}
                        data-testid={`admin-sub-fields-delete-${row.id}`}
                        title={t('admin.subFields.action.delete', 'Delete')}
                      >
                        <Trash2 size={13} aria-hidden />
                        {t('common.delete', 'Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && filtered.length > 0 && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalItems={sorted.length}
          startIndex={startIndex}
          endIndex={endIndex}
          onPrev={prev}
          onNext={next}
          onPage={setPage}
        />
      )}

      <SubFieldFormModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSuccess={() => void load({ force: true, majorId: getFilterMajorId() })}
      />
      <SubFieldFormModal
        open={modalMode === 'edit' && modalTarget !== null}
        mode={modalMode}
        target={modalTarget}
        onClose={() => setModalTarget(null)}
        onSuccess={() => void load({ force: true, majorId: getFilterMajorId() })}
      />

      {deleteTarget && (
        <ConfirmModal
          open={!!deleteTarget}
          title={t('admin.subFields.deleteModal.title', 'Delete sub-field')}
          description={t(
            'admin.subFields.deleteModal.desc',
            'Are you sure you want to delete "{name}"? This action cannot be undone.',
            { name: deleteTarget.name },
          )}
          variant="destructive"
          confirmLabel={
            isDeleting
              ? t('common.deleting', 'Deleting…')
              : t('common.delete', 'Delete')
          }
          cancelLabel={t('common.cancel', 'Cancel')}
          onConfirm={() => void handleConfirmDelete()}
          onClose={() => {
            if (!isDeleting) setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
};

// ── Tab 3: Grading Rubic ────────────────────────────────────────────
const GradingRubricSurface = () => {
  const { t } = useI18n();
  const [rows, setRows] = useState<SubFieldWithRubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalTarget, setModalTarget] = useState<SubFieldWithRubric | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SubFieldWithRubric | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubFieldWithRubric | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sort = useTableSort<SubFieldWithRubric, GrSortColumn>('name', 'asc');

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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await fieldService.deleteSub(deleteTarget.subFieldId);
      toast.success(
        t('admin.rubric.toast.deleteSuccess', 'Sub-field deleted successfully.'),
      );
      setDeleteTarget(null);
      await load();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg =
        axiosErr.response?.data?.message ||
        t('admin.rubric.toast.deleteError', 'Failed to delete sub-field.');
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.majorFieldName.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const sorted = useMemo(
    () =>
      sort.sortedItemsBy(filtered, (row) => {
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
      }),
    [filtered, sort],
  );

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
    <div data-testid="admin-grading-rubric-surface">
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0' }}>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setCreateOpen(true)}
        >
          {t('admin.rubric.action.createSubField', 'Create Sub-field')}
        </Button>
      </div>

      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => void load()}
        isRefreshing={loading}
        searchPlaceholder={t('admin.rubric.search', 'Search sub-fields…')}
        refreshLabel={t('admin.rubric.refresh', 'Refresh')}
      />

      <div className={sharedStyles.tableWrap}>
        {loading ? (
          <div className={sharedStyles.loadingWrap}>
            <SkeletonRow count={6} rowHeight={36} withHeader />
          </div>
        ) : error ? (
          <div className={sharedStyles.errorWrap}>
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
                    ? t('admin.rubric.retrying', 'Retrying…')
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
            <table className={sharedStyles.table}>
              <thead>
                <tr>
                  <th className={sharedStyles.th}>
                    <SortableHeader
                      column="name"
                      label={t('admin.rubric.table.name', 'Sub-field')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th className={sharedStyles.th}>
                    <SortableHeader
                      column="majorFieldName"
                      label={t('admin.rubric.table.majorField', 'Major Field')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th className={sharedStyles.th}>
                    <SortableHeader
                      column="criteriaCount"
                      label={t('admin.rubric.table.criteriaCount', 'Criteria')}
                      cycleSort={sort.cycleSort}
                      ariaSortFor={sort.ariaSortFor}
                    />
                  </th>
                  <th className={sharedStyles.th}>
                    {t('admin.rubric.table.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row) => (
                  <tr key={row.subFieldId} className={sharedStyles.row}>
                    <td className={sharedStyles.td}>
                      <span className={sharedStyles.subFieldName}>{row.name}</span>
                    </td>
                    <td className={sharedStyles.td}>
                      <span className={sharedStyles.majorField}>{row.majorFieldName}</span>
                    </td>
                    <td className={sharedStyles.td}>
                      <span
                        className={
                          row.gradingRubric.length === 0
                            ? sharedStyles.countZero
                            : sharedStyles.count
                        }
                      >
                        {row.gradingRubric.length}{' '}
                        {t('admin.rubric.criteria', 'criteria')}
                      </span>
                    </td>
                    <td className={sharedStyles.td}>
                      <div className={sharedStyles.actions}>
                        <button
                          type="button"
                          className={`${sharedStyles.actionButton} ${sharedStyles.manageButton}`}
                          onClick={() => handleManage(row)}
                          title={t('admin.rubric.action.manage', 'Manage Rubric')}
                        >
                          <BookOpen size={14} />
                          {t('admin.rubric.action.manage', 'Manage Rubric')}
                        </button>
                        <button
                          type="button"
                          className={`${sharedStyles.actionButton} ${sharedStyles.editButton}`}
                          onClick={() => setEditTarget(row)}
                          title={t('admin.rubric.action.editSubField', 'Edit Sub-field')}
                        >
                          <Pencil size={13} />
                          {t('common.edit', 'Edit')}
                        </button>
                        <button
                          type="button"
                          className={`${sharedStyles.actionButton} ${sharedStyles.deleteButton}`}
                          onClick={() => setDeleteTarget(row)}
                          title={t('admin.rubric.action.deleteSubField', 'Delete Sub-field')}
                        >
                          <Trash2 size={13} />
                          {t('common.delete', 'Delete')}
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

      <CreateSubFieldModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => void load()}
      />

      <EditSubFieldModal
        subField={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => void load()}
      />

      {deleteTarget && (
        <ConfirmModal
          open={!!deleteTarget}
          title={t('admin.rubric.deleteModal.title', 'Delete Sub-field')}
          description={t(
            'admin.rubric.deleteModal.desc',
            'Are you sure you want to delete sub-field "{name}"? This action cannot be undone.',
            { name: deleteTarget.name },
          )}
          variant="destructive"
          confirmLabel={t('common.delete', 'Delete')}
          cancelLabel={t('common.cancel', 'Cancel')}
          onConfirm={handleConfirmDelete}
          onClose={() => {
            if (!isDeleting) setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminResearchField;

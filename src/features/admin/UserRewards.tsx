/**
 * UserRewards — Admin user-reward configuration.
 *
 * Lets the admin create, edit, toggle status, and delete reward rows
 * that drive platform automations (e.g. "researcher-published-paper").
 * The Publish flow calls /api/UserReward/match with the canonical
 * reward name; if a matching Active row exists, the author gets a
 * notification describing the credit.
 *
 * The page is a single-page (table + modal) pattern, mirroring
 * AdminPublicationLists so admins find the same affordances everywhere.
 *
 * No mock data — every row comes from /api/UserReward/paged.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  Check,
  Gift,
  Loader,
  Pencil,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import { userRewardService } from '../../services/userReward.service';
import {
  isActiveUserReward,
  type UserReward,
  type UserRewardCreateRequest,
  type UserRewardUpdateRequest,
} from '../../types/userReward';
import {
  REWARD_CATALOG,
  buildRewardView,
  type RewardViewRow,
  type RewardRole,
} from './rewardCatalog';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { ConfirmModal } from '../../components/lecturer/ConfirmModal';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { FieldError } from '../../components/FieldError';
import styles from './UserRewards.module.css';

const ROLE_ACCENT = 'var(--ars-admin)';

type StatusFilter = 'ALL' | 'Active' | 'InActive';

const roleLabelKey = (role: RewardRole): string => {
  switch (role) {
    case 'Researcher':
      return 'admin.userRewards.role.researcher';
    case 'Reviewer':
      return 'admin.userRewards.role.reviewer';
    case 'Lecturer':
      return 'admin.userRewards.role.lecturer';
    case 'GraduateStudent':
      return 'admin.userRewards.role.graduateStudent';
    default:
      return 'admin.userRewards.role.researcher';
  }
};

interface FormState {
  /** The slug stored on the BE row — set once and immutable for catalog entries */
  slug: string;
  name: string;
  description: string;
  rewardMonths: string;
  status: 'Active' | 'InActive';
}

/** True when the form name field should be locked to the catalog slug. */
const isCatalogEntry = (form: FormState): boolean =>
  REWARD_CATALOG.some((e) => e.slug === form.slug);

const emptyForm = (): FormState => ({
  slug: '',
  name: '',
  description: '',
  rewardMonths: '12',
  status: 'Active',
});

const formFromViewRow = (view: RewardViewRow): FormState => ({
  slug: view.slug,
  name: view.reward?.name ?? view.slug,
  description: view.reward?.description ?? '',
  rewardMonths:
    typeof view.reward?.rewardMonths === 'number' &&
    Number.isFinite(view.reward.rewardMonths)
      ? String(view.reward.rewardMonths)
      : '12',
  status: isActiveUserReward(
    typeof view.reward?.status === 'string' ? view.reward.status : null,
  )
    ? 'Active'
    : 'InActive',
});

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  variant: 'default' | 'destructive';
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

export const UserRewards = (): JSX.Element => {
  const { t } = useI18n();
  const locale = useLocale();
  useAdminGuard();

  const [rewards, setRewards] = useState<UserReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<UserReward | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [monthsError, setMonthsError] = useState<string | null>(null);

  // Confirm modal
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    variant: 'destructive',
    onConfirm: () => undefined,
  });

  const load = useCallback(
    async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const result = await userRewardService.listUserRewardsPaged({
          page: 1,
          pageSize: 100,
          search: search.trim(),
          status: statusFilter,
        });
        setRewards(result.items ?? []);
      } catch (loadError) {
        setRewards([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : t('admin.userRewards.error.loadFailed'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, statusFilter, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to first page when filters change — but the BE list already
  // returns everything via pageSize=100, so this is purely UI hygiene.
  useEffect(() => {
    setError(null);
  }, [search, statusFilter]);

  const openCreateModal = useCallback(() => {
    setEditingReward(null);
    setForm(emptyForm());
    setFormError(null);
    setNameError(null);
    setMonthsError(null);
    setFormOpen(true);
  }, []);

  const openEditModal = useCallback((view: RewardViewRow) => {
    const form = formFromViewRow(view);
    setEditingReward(view.reward);
    setForm(form);
    setFormError(null);
    setNameError(null);
    setMonthsError(null);
    setFormOpen(true);
  }, []);

  const closeFormModal = useCallback(() => {
    if (submitting) return;
    setFormOpen(false);
  }, [submitting]);

  const handleSubmitForm = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      const catalogEntry = isCatalogEntry(form);
      // For catalog entries the name is locked to the slug; no validation needed.
      const nameErr = catalogEntry
        ? null
        : form.name.trim()
          ? null
          : t('admin.userRewards.error.nameRequired');
      const trimmedMonths = form.rewardMonths.trim();
      const parsedMonths = Number(trimmedMonths);
      const monthsErr =
        !trimmedMonths ||
        !Number.isFinite(parsedMonths) ||
        !Number.isInteger(parsedMonths) ||
        parsedMonths < 1 ||
        parsedMonths > 1200
          ? t('admin.userRewards.error.monthsInvalid')
          : null;
      setNameError(nameErr);
      setMonthsError(monthsErr);
      if (nameErr || monthsErr) return;

      setSubmitting(true);
      setFormError(null);
      try {
        if (editingReward && typeof editingReward.id === 'number') {
          const payload: UserRewardUpdateRequest = {
            // Catalog entries always use the canonical slug as the BE name;
            // custom rewards use whatever the admin typed.
            name: catalogEntry ? form.slug : form.name.trim(),
            description: form.description.trim() || null,
            rewardMonths: parsedMonths,
            status: form.status,
          };
          await userRewardService.updateUserReward(editingReward.id, payload);
        } else {
          const payload: UserRewardCreateRequest = {
            name: catalogEntry ? form.slug : form.name.trim(),
            description: form.description.trim() || null,
            rewardMonths: parsedMonths,
            status: form.status,
          };
          await userRewardService.createUserReward(payload);
        }
        setFormOpen(false);
        await load();
      } catch (caught) {
        setFormError(
          caught instanceof Error
            ? caught.message
            : t('admin.userRewards.error.saveFailed'),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [editingReward, form, load, t],
  );

  const handleToggle = useCallback(
    (view: RewardViewRow) => {
      const row = view.reward;
      if (!row || typeof row.id !== 'number') return;
      const nextStatus = !isActiveUserReward(
        typeof row.status === 'string' ? row.status : null,
      );
      const nextLabel = nextStatus ? 'Active' : 'InActive';
      const displayName = view.displayKey ? t(view.displayKey) : (row.name || `#${row.id}`);
      setConfirm({
        open: true,
        title: nextStatus
          ? t('admin.userRewards.confirm.activateTitle')
          : t('admin.userRewards.confirm.deactivateTitle'),
        description: nextStatus
          ? t('admin.userRewards.confirm.activateDesc').replace('{name}', displayName)
          : t('admin.userRewards.confirm.deactivateDesc').replace('{name}', displayName),
        variant: 'default',
        onConfirm: async () => {
          setConfirm((prev) => ({ ...prev, busy: true }));
          try {
            await userRewardService.patchUserRewardStatus(row.id, nextLabel);
            await load();
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : t('admin.userRewards.error.toggleFailed'),
            );
          } finally {
            setConfirm((prev) => ({
              ...prev,
              open: false,
              busy: false,
            }));
          }
        },
      });
    },
    [load, t],
  );

  const handleDelete = useCallback(
    (view: RewardViewRow) => {
      const row = view.reward;
      if (!row || typeof row.id !== 'number') return;
      const displayName = view.displayKey ? t(view.displayKey) : (row.name || `#${row.id}`);
      setConfirm({
        open: true,
        title: t('admin.userRewards.confirm.deleteTitle'),
        description: t('admin.userRewards.confirm.deleteDesc').replace('{name}', displayName),
        variant: 'destructive',
        onConfirm: async () => {
          setConfirm((prev) => ({ ...prev, busy: true }));
          try {
            await userRewardService.deleteUserReward(row.id);
            await load();
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : t('admin.userRewards.error.deleteFailed'),
            );
          } finally {
            setConfirm((prev) => ({
              ...prev,
              open: false,
              busy: false,
            }));
          }
        },
      });
    },
    [load, t],
  );

  const viewRows = useMemo(() => buildRewardView(rewards), [rewards]);

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return viewRows.filter((view) => {
      const reward = view.reward;
      const displayName = view.displayKey ? t(view.displayKey) : view.slug;
      const description = view.descriptionKey
        ? t(view.descriptionKey)
        : reward?.description ?? '';
      const status = reward && typeof reward.status === 'string' ? reward.status : '';
      if (statusFilter === 'Active') {
        // Only show the active row when the BE row exists AND is active.
        // Catalog entries without a BE row are treated as "needs configuration".
        if (!isActiveUserReward(status)) return false;
      } else if (statusFilter === 'InActive') {
        if (!reward) return false;
        if (isActiveUserReward(status)) return false;
      }
      if (lower) {
        const haystack = `${displayName} ${description} ${view.slug} ${view.role}`.toLowerCase();
        if (!haystack.includes(lower)) return false;
      }
      return true;
    });
  }, [viewRows, search, statusFilter, t]);

  const statusChips = useMemo(
    () => [
      { value: 'ALL' as StatusFilter, label: t('admin.userRewards.status.allStatuses') },
      { value: 'Active' as StatusFilter, label: t('admin.userRewards.status.active') },
      { value: 'InActive' as StatusFilter, label: t('admin.userRewards.status.inactive') },
    ],
    [t],
  );

  const monthUnit = (n: number): string => {
    // ICU-style — keys expose `_one` / `_other`. English distinguishes
    // singular ("month") from plural ("months"); Vietnamese is uniform.
    // The number is rendered separately in the cell so this returns only
    // the unit word ("month" / "months" / "tháng").
    if (locale === 'vi') return t('admin.userRewards.units.month_other');
    return n === 1
      ? t('admin.userRewards.units.month_one')
      : t('admin.userRewards.units.month_other');
  };

  const bumpMonths = useCallback(
    (delta: number) => {
      setForm((prev) => {
        const current = Number(prev.rewardMonths || '0') || 0;
        const next = Math.max(1, Math.min(1200, current + delta));
        return { ...prev, rewardMonths: String(next) };
      });
      if (monthsError) setMonthsError(null);
    },
    [monthsError],
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={t('admin.userRewards.eyebrow')}
        title={t('admin.userRewards.title')}
        description={t('admin.userRewards.description')}
        accent={ROLE_ACCENT}
        actions={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setRefreshing(true);
                void load();
              }}
              disabled={loading}
              data-testid="user-rewards-refresh"
              leftIcon={<RefreshCw size={16} aria-hidden />}
            >
              {loading || refreshing
                ? t('admin.userRewards.refreshing')
                : t('admin.userRewards.refresh')}
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={16} aria-hidden />}
              onClick={openCreateModal}
              data-testid="user-rewards-create"
            >
              {t('admin.userRewards.create')}
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchField}>
          <Search size={16} className={styles.searchIcon} aria-hidden />
          <input
            type="search"
            className={styles.searchInput}
            placeholder={t('admin.userRewards.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="user-rewards-search"
          />
          {search && (
            <button
              type="button"
              className={styles.searchClear}
              aria-label="Clear search"
              onClick={() => setSearch('')}
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.statusTabs} role="tablist">
            {statusChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                role="tab"
                aria-selected={statusFilter === chip.value}
                className={`${styles.statusTabBtn} ${
                  statusFilter === chip.value ? styles.statusTabBtnActive : ''
                }`}
                onClick={() => setStatusFilter(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          retry={
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                void load();
              }}
            >
              {t('admin.userRewards.retry')}
            </button>
          }
        />
      )}

      {/* Table or empty state */}
      {loading ? (
        <div className={styles.tableWrap} aria-hidden>
          <div className={styles.loadingRows}>
            <SkeletonRow count={6} rowHeight={36} withHeader={false} />
          </div>
        </div>
      ) : rewards.length === 0 ? (
        <div className={styles.unavailableNotice} data-testid="user-rewards-empty">
          <span className={styles.emptyIllustration} aria-hidden>
            <Gift size={26} />
          </span>
          <strong>{t('admin.userRewards.empty.noDataTitle')}</strong>
          <span>{t('admin.userRewards.empty.noDataDesc')}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.unavailableNotice} data-testid="user-rewards-empty-filter">
          <span className={styles.emptyIllustration} aria-hidden>
            <Search size={26} />
          </span>
          <strong>{t('admin.userRewards.empty.noMatchTitle')}</strong>
          <span>{t('admin.userRewards.empty.noMatchDesc')}</span>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.tableScroll}>
            <table className={styles.table} data-testid="user-rewards-table">
              <thead>
                <tr>
                  <th scope="col">{t('admin.userRewards.table.name')}</th>
                  <th scope="col">{t('admin.userRewards.table.role')}</th>
                  <th scope="col">{t('admin.userRewards.table.description')}</th>
                  <th scope="col">{t('admin.userRewards.table.months')}</th>
                  <th scope="col">{t('admin.userRewards.table.status')}</th>
                  <th scope="col">{t('admin.userRewards.table.updated')}</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    {t('admin.userRewards.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((view) => {
                  const reward = view.reward;
                  const active = isActiveUserReward(
                    typeof reward?.status === 'string' ? reward.status : null,
                  );
                  const key = view.key;

                  // Resolve display name and description from catalog or raw data.
                  const displayName = view.displayKey
                    ? t(view.displayKey)
                    : reward?.name ?? '—';
                  const description = view.descriptionKey
                    ? t(view.descriptionKey)
                    : reward?.description ?? '';
                  const months =
                    typeof reward?.rewardMonths === 'number' &&
                    Number.isFinite(reward.rewardMonths)
                      ? reward.rewardMonths
                      : null;
                  const updatedAt = reward?.updatedAt ?? reward?.createdAt;
                  const isConfigured = Boolean(reward);

                  return (
                    <tr key={key} data-testid={`user-rewards-row-${key}`}>
                      <td>
                        <div className={styles.nameCell}>
                          <span className={styles.nameText}>{displayName}</span>
                          {!isConfigured && (
                            <span className={styles.notConfiguredBadge}>
                              {t('admin.userRewards.notConfigured')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={styles.rolePill}
                          style={{ color: ROLE_ACCENT }}
                        >
                          {t(roleLabelKey(view.role))}
                        </span>
                      </td>
                      <td>
                        <div className={styles.descriptionCell}>
                          <span>{description || '—'}</span>
                        </div>
                      </td>
                      <td>
                        {months !== null ? (
                          <span className={styles.monthsCell}>
                            <span className={styles.monthsValue}>{months}</span>
                            <span className={styles.monthsSuffix}>
                              {monthUnit(months)}
                            </span>
                          </span>
                        ) : (
                          <span className={styles.notConfiguredBadge}>
                            {t('admin.userRewards.notConfigured')}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`${styles.statusPill} ${
                            isConfigured && active
                              ? styles.statusPillActive
                              : styles.statusPillInactive
                          }`}
                        >
                          {isConfigured
                            ? active
                              ? t('admin.userRewards.status.active')
                              : t('admin.userRewards.status.inactive')
                            : '—'}
                        </span>
                      </td>
                      <td>
                        <span className={styles.updatedCell}>
                          {updatedAt ? formatDate(updatedAt) : '—'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {isConfigured ? (
                            <>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => openEditModal(view)}
                                title={t('admin.userRewards.edit')}
                                aria-label={t('admin.userRewards.edit')}
                                data-testid={`user-rewards-edit-${key}`}
                              >
                                <Pencil size={14} aria-hidden />
                              </button>
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => handleToggle(view)}
                                title={
                                  active
                                    ? t('admin.userRewards.deactivate')
                                    : t('admin.userRewards.activate')
                                }
                                aria-label={
                                  active
                                    ? t('admin.userRewards.deactivate')
                                    : t('admin.userRewards.activate')
                                }
                                data-testid={`user-rewards-toggle-${key}`}
                              >
                                {active ? (
                                  <ToggleRight size={14} aria-hidden />
                                ) : (
                                  <ToggleLeft size={14} aria-hidden />
                                )}
                              </button>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                onClick={() => handleDelete(view)}
                                title={t('admin.userRewards.delete')}
                                aria-label={t('admin.userRewards.delete')}
                                data-testid={`user-rewards-delete-${key}`}
                              >
                                <Trash2 size={14} aria-hidden />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => openEditModal(view)}
                              title={t('admin.userRewards.configure')}
                              aria-label={t('admin.userRewards.configure')}
                              data-testid={`user-rewards-configure-${key}`}
                            >
                              <PlusCircle size={14} aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {formOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <h3 className={styles.modalTitle}>
                {editingReward
                  ? t('admin.userRewards.form.editTitle')
                  : isCatalogEntry(form)
                    ? t('admin.userRewards.form.configureTitle')
                    : t('admin.userRewards.form.createTitle')}
              </h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeFormModal}
                aria-label={t('admin.userRewards.form.close')}
                disabled={submitting}
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <form onSubmit={handleSubmitForm} className={styles.modalForm}>
              {isCatalogEntry(form) ? (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {t('admin.userRewards.form.name')}
                  </label>
                  <div className={styles.formStaticValue}>
                    {t('admin.userRewards.researchPublication.displayName')}
                  </div>
                  <span className={styles.formHint}>
                    {t('admin.userRewards.form.nameCatalogHint')}
                  </span>
                </div>
              ) : (
                <div className={styles.formGroup}>
                  <label htmlFor="user-reward-name" className={styles.formLabel}>
                    * {t('admin.userRewards.form.name')}
                  </label>
                  <input
                    id="user-reward-name"
                    type="text"
                    className={`${styles.formInput} ${
                      nameError ? styles.formInputError : ''
                    }`}
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      if (nameError) setNameError(null);
                    }}
                    placeholder={t('admin.userRewards.form.namePlace')}
                    aria-invalid={Boolean(nameError)}
                    required
                  />
                  <FieldError message={nameError} />
                </div>
              )}

              <div className={styles.formGroup}>
                <label htmlFor="user-reward-description" className={styles.formLabel}>
                  {t('admin.userRewards.form.description')}
                </label>
                <textarea
                  id="user-reward-description"
                  className={`${styles.formInput} ${styles.textarea}`}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder={t('admin.userRewards.form.descriptionPlace')}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="user-reward-months" className={styles.formLabel}>
                  * {t('admin.userRewards.form.months')}
                </label>
                <div className={styles.monthsStepper}>
                  <button
                    type="button"
                    className={styles.monthsStepperBtn}
                    onClick={() => bumpMonths(-1)}
                    aria-label="Decrease months"
                    disabled={Number(form.rewardMonths) <= 1}
                  >
                    −
                  </button>
                  <input
                    id="user-reward-months"
                    type="number"
                    min={1}
                    max={1200}
                    step={1}
                    inputMode="numeric"
                    className={`${styles.monthsStepperInput} ${
                      monthsError ? styles.formInputError : ''
                    }`}
                    value={form.rewardMonths}
                    onChange={(e) => {
                      setForm({ ...form, rewardMonths: e.target.value });
                      if (monthsError) setMonthsError(null);
                    }}
                    aria-invalid={Boolean(monthsError)}
                    required
                  />
                  <button
                    type="button"
                    className={styles.monthsStepperBtn}
                    onClick={() => bumpMonths(1)}
                    aria-label="Increase months"
                    disabled={Number(form.rewardMonths) >= 1200}
                  >
                    +
                  </button>
                </div>
                <span className={styles.formHint}>
                  {t('admin.userRewards.form.monthsHint')}
                </span>
                <FieldError message={monthsError} />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="user-reward-status" className={styles.formLabel}>
                  {t('admin.userRewards.table.status')}
                </label>
                <select
                  id="user-reward-status"
                  className={styles.statusSelect}
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as 'Active' | 'InActive',
                    })
                  }
                >
                  <option value="Active">{t('admin.userRewards.status.active')}</option>
                  <option value="InActive">
                    {t('admin.userRewards.status.inactive')}
                  </option>
                </select>
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.status === 'Active'}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.checked ? 'Active' : 'InActive',
                    })
                  }
                  data-testid="user-rewards-status-checkbox"
                />
                <span>{t('admin.userRewards.form.active')}</span>
              </label>

              {formError && (
                <div className={styles.errorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{formError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeFormModal}
                  disabled={submitting}
                >
                  {t('admin.userRewards.form.cancel')}
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitting}
                  data-testid="user-rewards-form-submit"
                >
                  {submitting ? (
                    <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  ) : (
                    <Check size={14} aria-hidden />
                  )}
                  {submitting
                    ? t('admin.userRewards.form.saving')
                    : editingReward
                      ? t('admin.userRewards.form.saveChanges')
                      : t('admin.userRewards.form.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      {confirm.open && (
        <ConfirmModal
          open={confirm.open}
          title={confirm.title}
          description={confirm.description}
          variant={confirm.variant}
          confirmLabel={t('admin.userRewards.confirm.confirm')}
          cancelLabel={t('admin.userRewards.confirm.cancel')}
          onConfirm={confirm.onConfirm}
          onClose={() =>
            setConfirm((prev) => ({ ...prev, open: false, busy: false }))
          }
        />
      )}
    </div>
  );
};

export default UserRewards;

/**
 * AnnualFees — Admin annual-subscription management.
 *
 * Wires the live BE AnnualFees contract (BE-ANNUAL-FEE-01). The page exposes:
 *
 *   - Card-grid of every plan (active + inactive)
 *   - Server-side search by name + filters by role / status
 *   - Create / Edit / Toggle / Delete actions per card
 *   - "Subscribers" modal that lists active subscribers (fullName,
 *     email, expiryDate) for the plan
 *
 * Plans with active subscribers cannot be deactivated or deleted.
 *
 * No mock rows. No fabricated VND amounts. All prices come from the BE.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Eye,
  Loader,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { annualFeeService } from '../../services/annualFee.service';
import type {
  AnnualFee,
  AnnualFeeBillingCycle,
  AnnualFeeSubscriber,
  AnnualFeeTargetRole,
  AnnualFeeUpsertRequest,
} from '../../types/annualFee';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { useAnnualFeeSubscribers } from '../../hooks/useAnnualFeeSubscribers';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { ConfirmModal } from '../../components/lecturer/ConfirmModal';
import { FieldError } from '../../components/FieldError';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import styles from './AnnualFees.module.css';

const ROLE_ACCENT = 'var(--ars-admin)';

/**
 * BE accepts only `SixMonth` and `Annual`. Source of truth: the BE
 * confirmed the accepted values in the 400 response body:
 * "BillingCycle must be 'SixMonth' or 'Annual'".
 */
const BILLING_CYCLE_OPTIONS: AnnualFeeBillingCycle[] = ['SixMonth', 'Annual'];

const TARGET_ROLE_OPTIONS: AnnualFeeTargetRole[] = [
  'Researcher',
  'Lecturer',
];

/** Friendly "Six months" / "Twelve months" copy. Keys map 1:1 to i18n. */
const billingCycleLabelKey = (
  cycle: AnnualFeeBillingCycle,
): 'admin.annualFees.form.billingCycle.sixMonth' | 'admin.annualFees.form.billingCycle.annual' => {
  if (cycle === 'SixMonth') return 'admin.annualFees.form.billingCycle.sixMonth';
  return 'admin.annualFees.form.billingCycle.annual';
};

interface FormState {
  name: string;
  userRole: AnnualFeeTargetRole;
  price: string;
  billingCycle: AnnualFeeBillingCycle;
  status: boolean;
}

const emptyForm = (): FormState => ({
  name: '',
  userRole: 'Researcher',
  price: '',
  billingCycle: 'Annual',
  status: true,
});

const formFromPlan = (plan: AnnualFee): FormState => ({
  name: plan.name ?? '',
  userRole: (plan.userRole ?? 'Researcher') as AnnualFeeTargetRole,
  price: plan.price != null ? String(plan.price) : '',
  billingCycle: (plan.billingCycle ?? 'Annual') as AnnualFeeBillingCycle,
  status: plan.status ?? true,
});

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  variant: 'default' | 'destructive';
  onConfirm: () => void;
}

interface SubscribersModalState {
  open: boolean;
  plan: AnnualFee | null;
}

const readSubscriberCount = (plan: AnnualFee): number =>
  typeof plan.activeSubscriberCount === 'number' && plan.activeSubscriberCount > 0
    ? plan.activeSubscriberCount
    : 0;

/**
 * Format an ISO expiry string into a compact `dd MMM yyyy` date. Falls
 * back to the raw string when the value is missing or unparseable.
 */
const formatSubscriberExpiry = (iso: string): string => {
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

const AnnualFees = (): JSX.Element => {
  const { t } = useI18n();
  useAdminGuard();

  const formatPrice = useCallback(
    (price: number | null | undefined): string =>
      typeof price === 'number'
        ? `${price.toLocaleString('vi-VN')} ${t('admin.annualFees.vnd')}`
        : t('admin.annualFees.notSupplied'),
    [t],
  );

  const [fees, setFees] = useState<AnnualFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | AnnualFeeTargetRole>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>(
    'ALL',
  );

  // Form modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AnnualFee | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [formNameError, setFormNameError] = useState<string | null>(null);
  const [formPriceError, setFormPriceError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Confirm modal state
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    variant: 'destructive',
    onConfirm: () => undefined,
  });

  // Subscribers modal state
  const [subscribers, setSubscribers] = useState<SubscribersModalState>({
    open: false,
    plan: null,
  });

  const subscribersQuery = useAnnualFeeSubscribers({
    planId: subscribers.open ? subscribers.plan?.id ?? null : null,
    enabled: subscribers.open,
  });

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // The BE list endpoint paginates; we request a generous page size
      // so the grid renders the full set without manual paging. The
      // BE still applies search/role/status filters.
      const result = await annualFeeService.listAnnualFeePlans({
        page: 1,
        pageSize: 100,
        search: search.trim(),
        userRole: roleFilter,
        status: statusFilter,
        sortBy: 'CreatedAt',
        sortDir: 'desc',
      });
      setFees(result.items ?? []);
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
  }, [search, roleFilter, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreateModal = useCallback(() => {
    setEditingPlan(null);
    setForm(emptyForm());
    setFormError(null);
    setFormNameError(null);
    setFormPriceError(null);
    setFormOpen(true);
  }, []);

  const openEditModal = useCallback((plan: AnnualFee) => {
    setEditingPlan(plan);
    setForm(formFromPlan(plan));
    setFormError(null);
    setFormNameError(null);
    setFormPriceError(null);
    setFormOpen(true);
  }, []);

  const closeFormModal = useCallback(() => {
    if (submitting) return;
    setFormOpen(false);
  }, [submitting]);

  const handleSubmitForm = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = form.name.trim();
      const nameErr = trimmedName ? null : t('admin.annualFees.error.nameRequired');
      const trimmedPrice = form.price.trim();
      const parsedPrice = Number(trimmedPrice);
      const priceErr =
        !trimmedPrice || !Number.isFinite(parsedPrice) || parsedPrice <= 0
          ? t('admin.annualFees.error.priceInvalid')
          : null;
      setFormNameError(nameErr);
      setFormPriceError(priceErr);
      if (nameErr || priceErr) return;

      // The BE no longer accepts startDate / endDate on create — the
      // form omits them intentionally. Plan lifecycle is controlled
      // through the `status` toggle (activate / deactivate).
      const payload: AnnualFeeUpsertRequest = {
        name: trimmedName,
        userRole: form.userRole,
        price: parsedPrice,
        billingCycle: form.billingCycle,
        status: form.status,
      };

      setSubmitting(true);
      setFormError(null);
      try {
        if (editingPlan && typeof editingPlan.id === 'number') {
          await annualFeeService.updateAnnualFeePlan(editingPlan.id, payload);
        } else {
          await annualFeeService.createAnnualFeePlan(payload);
        }
        setFormOpen(false);
        await load();
      } catch (caught) {
        setFormError(
          caught instanceof Error
            ? caught.message
            : t('admin.annualFees.error.saveFailed'),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [editingPlan, form, load, t],
  );

  const handleToggle = useCallback(
    (plan: AnnualFee) => {
      if (typeof plan.id !== 'number') return;
      const subscribersCount = readSubscriberCount(plan);
      // Block deactivating a plan that still has active subscribers.
      // Activating is always allowed (and free of the guard).
      if (plan.status && subscribersCount > 0) {
        setError(t('admin.annualFees.action.disabled.hasSubscribers'));
        return;
      }
      const nextStatus = !plan.status;
      setConfirm({
        open: true,
        title: nextStatus
          ? t('admin.annualFees.confirm.activateTitle')
          : t('admin.annualFees.confirm.deactivateTitle'),
        description: nextStatus
          ? t('admin.annualFees.confirm.activateDesc').replace(
              '{name}',
              plan.name ?? `#${plan.id}`,
            )
          : t('admin.annualFees.confirm.deactivateDesc').replace(
              '{name}',
              plan.name ?? `#${plan.id}`,
            ),
        variant: 'default',
        onConfirm: async () => {
          try {
            await annualFeeService.toggleAnnualFeePlan(plan.id, nextStatus);
            await load();
          } catch (caught) {
            setError(
              caught instanceof Error ? caught.message : t('admin.annualFees.error.toggleFailed'),
            );
          } finally {
            setConfirm((prev) => ({ ...prev, open: false }));
          }
        },
      });
    },
    [load, t],
  );

  const handleDelete = useCallback(
    (plan: AnnualFee) => {
      if (typeof plan.id !== 'number') return;
      if (readSubscriberCount(plan) > 0) {
        setError(t('admin.annualFees.action.disabled.hasSubscribers'));
        return;
      }
      setConfirm({
        open: true,
        title: t('admin.annualFees.confirm.deleteTitle'),
        description: t('admin.annualFees.confirm.deleteDesc').replace(
          '{name}',
          plan.name ?? `#${plan.id}`,
        ),
        variant: 'destructive',
        onConfirm: async () => {
          try {
            await annualFeeService.deleteAnnualFeePlan(plan.id);
            await load();
          } catch (caught) {
            setError(
              caught instanceof Error ? caught.message : t('admin.annualFees.error.deleteFailed'),
            );
          } finally {
            setConfirm((prev) => ({ ...prev, open: false }));
          }
        },
      });
    },
    [load, t],
  );

  const openSubscribersModal = useCallback((plan: AnnualFee) => {
    setSubscribers({ open: true, plan });
  }, []);

  const closeSubscribersModal = useCallback(() => {
    setSubscribers({ open: false, plan: null });
  }, []);

  // Pluralised "X subscribers" label.
  const subscribersLabel = (count: number): string => {
    if (count === 0) return t('admin.annualFees.card.subscribers_zero');
    // ICU-style {count} placeholder — the dictionary carries
    // `_zero` / `_one` / `_other` if you ever wire a real plural
    // helper, but for now we map manually.
    return count === 1
      ? t('admin.annualFees.card.subscribers').replace('{count}', '1')
      : t('admin.annualFees.card.subscribers_other').replace(
          '{count}',
          String(count),
        );
  };

  const statusChips = useMemo(
    () => [
      { value: 'ALL', label: t('admin.annualFees.status.allStatuses') },
      { value: 'ACTIVE', label: t('admin.annualFees.status.active') },
      { value: 'INACTIVE', label: t('admin.annualFees.status.inactive') },
    ],
    [t],
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={t('admin.annualFees.eyebrow')}
        title={t('admin.annualFees.title')}
        description={t('admin.annualFees.description')}
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
              data-testid="annual-fees-refresh"
              leftIcon={<RefreshCw size={16} aria-hidden />}
            >
              {loading || refreshing
                ? t('admin.annualFees.refreshing')
                : t('admin.annualFees.refresh')}
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={16} aria-hidden />}
              onClick={openCreateModal}
              data-testid="annual-fees-create"
            >
              {t('admin.annualFees.create')}
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
            placeholder={t('admin.annualFees.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="annual-fees-search"
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
          <div className={styles.filterChip}>
            <label htmlFor="filter-role" className={styles.filterLabel}>
              {t('admin.annualFees.filters.role')}
            </label>
            <select
              id="filter-role"
              className={styles.filterSelect}
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as '' | AnnualFeeTargetRole)
              }
              data-testid="annual-fees-filter-role"
            >
              <option value="">{t('admin.annualFees.filters.all')}</option>
              {TARGET_ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

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
                onClick={() =>
                  setStatusFilter(chip.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
                }
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
              {t('admin.annualFees.retry')}
            </button>
          }
        />
      )}

      {/* Card grid */}
      {loading ? (
        <div className={styles.grid} aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <SkeletonRow count={4} rowHeight={14} withHeader={false} />
            </div>
          ))}
        </div>
      ) : fees.length === 0 ? (
        <div className={styles.unavailableNotice} data-testid="annual-fees-empty">
          <AlertTriangle size={26} aria-hidden />
          <strong>
            {search || roleFilter || statusFilter !== 'ALL'
              ? t('admin.annualFees.empty.noMatchTitle')
              : t('admin.annualFees.empty.noDataTitle')}
          </strong>
          <span>
            {search || roleFilter || statusFilter !== 'ALL'
              ? t('admin.annualFees.empty.noMatchDesc')
              : t('admin.annualFees.empty.noDataDesc')}
          </span>
        </div>
      ) : (
        <div className={styles.grid}>
          {fees.map((fee) => {
            const subscriberCount = readSubscriberCount(fee);
            const hasSubscribers = subscriberCount > 0;
            const disabledHint = hasSubscribers
              ? t('admin.annualFees.action.disabled.hasSubscribers')
              : '';
            const cycleLabel = t(billingCycleLabelKey(fee.billingCycle as AnnualFeeBillingCycle));
            return (
              <article
                key={fee.id}
                className={`${styles.card} ${fee.status ? styles.cardActive : styles.cardInactive}`}
                data-testid={`annual-fees-card-${fee.id}`}
              >
                <header className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    <span className={styles.rolePill}>{fee.userRole}</span>
                    <span
                      className={`${styles.statusPill} ${
                        fee.status ? styles.statusActive : styles.statusInactive
                      }`}
                    >
                      {fee.status
                        ? t('admin.annualFees.status.active')
                        : t('admin.annualFees.status.inactive')}
                    </span>
                  </div>
                  <h3 className={styles.cardTitle}>{fee.name}</h3>
                </header>

                <dl className={styles.cardMeta}>
                  <div className={styles.metaRow}>
                    <dt className={styles.metaLabel}>
                      {t('admin.annualFees.table.price')}
                    </dt>
                    <dd className={styles.metaPrice}>{formatPrice(fee.price)}</dd>
                  </div>
                  <div className={styles.metaRow}>
                    <dt className={styles.metaLabel}>
                      {t('admin.annualFees.table.billingCycle')}
                    </dt>
                    <dd>
                      <span className={styles.cycleBadge}>{cycleLabel}</span>
                    </dd>
                  </div>
                </dl>

                <footer className={styles.cardFooter}>
                  <div
                    className={styles.subscriberBadge}
                    data-has-subscribers={hasSubscribers ? 'true' : 'false'}
                  >
                    <Users size={14} aria-hidden />
                    <span>{subscribersLabel(subscriberCount)}</span>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => openSubscribersModal(fee)}
                      data-testid={`annual-fees-subscribers-${fee.id}`}
                    >
                      <Eye size={14} aria-hidden />
                      <span>{t('admin.annualFees.card.viewSubscribers')}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => openEditModal(fee)}
                      title={t('admin.annualFees.edit')}
                      aria-label={t('admin.annualFees.edit')}
                      data-testid={`annual-fees-edit-${fee.id}`}
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleToggle(fee)}
                      disabled={fee.status && hasSubscribers}
                      title={
                        fee.status && hasSubscribers
                          ? disabledHint
                          : fee.status
                            ? t('admin.annualFees.deactivate')
                            : t('admin.annualFees.activate')
                      }
                      aria-label={
                        fee.status && hasSubscribers
                          ? disabledHint
                          : fee.status
                            ? t('admin.annualFees.deactivate')
                            : t('admin.annualFees.activate')
                      }
                      data-testid={`annual-fees-toggle-${fee.id}`}
                    >
                      {fee.status ? (
                        <ToggleRight size={14} aria-hidden />
                      ) : (
                        <ToggleLeft size={14} aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => handleDelete(fee)}
                      disabled={hasSubscribers}
                      title={
                        hasSubscribers
                          ? disabledHint
                          : t('admin.annualFees.delete')
                      }
                      aria-label={
                        hasSubscribers
                          ? disabledHint
                          : t('admin.annualFees.delete')
                      }
                      data-testid={`annual-fees-delete-${fee.id}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {formOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeaderRow}>
              <h3 className={styles.modalTitle}>
                {editingPlan
                  ? t('admin.annualFees.form.editTitle')
                  : t('admin.annualFees.form.createTitle')}
              </h3>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeFormModal}
                aria-label={t('admin.annualFees.form.close')}
                disabled={submitting}
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <form onSubmit={handleSubmitForm} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label htmlFor="annual-fee-name" className={styles.formLabel}>
                  * {t('admin.annualFees.form.name')}
                </label>
                <input
                  id="annual-fee-name"
                  type="text"
                  className={`${styles.formInput} ${
                    formNameError ? styles.formInputError : ''
                  }`}
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (formNameError) setFormNameError(null);
                  }}
                  placeholder={t('admin.annualFees.form.namePlace')}
                  aria-invalid={Boolean(formNameError)}
                  required
                />
                <FieldError message={formNameError} />
              </div>

              <div className={styles.formRowSplit}>
                <div className={styles.formGroup}>
                  <label htmlFor="annual-fee-role" className={styles.formLabel}>
                    * {t('admin.annualFees.form.role')}
                  </label>
                  <select
                    id="annual-fee-role"
                    className={styles.formInput}
                    value={form.userRole}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        userRole: e.target.value as AnnualFeeTargetRole,
                      })
                    }
                    required
                  >
                    {TARGET_ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="annual-fee-cycle" className={styles.formLabel}>
                    * {t('admin.annualFees.form.cycle')}
                  </label>
                  <select
                    id="annual-fee-cycle"
                    className={styles.formInput}
                    value={form.billingCycle}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        billingCycle: e.target.value as AnnualFeeBillingCycle,
                      })
                    }
                    required
                  >
                    {BILLING_CYCLE_OPTIONS.map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {t(billingCycleLabelKey(cycle))}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="annual-fee-price" className={styles.formLabel}>
                  * {t('admin.annualFees.form.price')}
                </label>
                <input
                  id="annual-fee-price"
                  type="number"
                  min={1}
                  step={1}
                  className={`${styles.formInput} ${
                    formPriceError ? styles.formInputError : ''
                  }`}
                  value={form.price}
                  onChange={(e) => {
                    setForm({ ...form, price: e.target.value });
                    if (formPriceError) setFormPriceError(null);
                  }}
                  placeholder="990000"
                  aria-invalid={Boolean(formPriceError)}
                  required
                />
                <FieldError message={formPriceError} />
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.checked })}
                  data-testid="annual-fees-status-checkbox"
                />
                <span>{t('admin.annualFees.form.active')}</span>
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
                  {t('admin.annualFees.form.cancel')}
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitting}
                  data-testid="annual-fees-form-submit"
                >
                  {submitting ? (
                    <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  ) : (
                    <Check size={14} aria-hidden />
                  )}
                  {submitting
                    ? t('admin.annualFees.form.saving')
                    : editingPlan
                      ? t('admin.annualFees.form.saveChanges')
                      : t('admin.annualFees.form.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBSCRIBERS MODAL */}
      {subscribers.open && subscribers.plan && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div
            className={`${styles.modalCard} ${styles.modalCardWide}`}
            role="document"
          >
            <div className={styles.modalHeaderRow}>
              <div>
                <h3 className={styles.modalTitle}>
                  {t('admin.annualFees.subscribers.title')}
                </h3>
                <p className={styles.modalSubtitle}>{subscribers.plan.name}</p>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closeSubscribersModal}
                aria-label={t('admin.annualFees.subscribers.close')}
                data-testid="annual-fees-subscribers-close"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className={styles.modalToolbar}>
              <span className={styles.subscribersTotal}>
                {t('admin.annualFees.card.subscribers_other').replace(
                  '{count}',
                  String(subscribersQuery.total),
                )}
              </span>
            </div>

            <div className={styles.subscribersBody}>
              {subscribersQuery.loading ? (
                <div className={styles.subscribersLoading} role="status">
                  <Loader size={18} className={styles.spinningIcon} aria-hidden />
                  <span>{t('admin.annualFees.refreshing')}</span>
                </div>
              ) : subscribersQuery.error ? (
                <div
                  className={styles.subscribersEmpty}
                  data-testid="annual-fees-subscribers-error"
                >
                  <AlertTriangle size={22} aria-hidden />
                  <strong>{subscribersQuery.error}</strong>
                  <button
                    type="button"
                    className={styles.retryBtn}
                    onClick={subscribersQuery.reload}
                  >
                    {t('admin.annualFees.retry')}
                  </button>
                </div>
              ) : subscribersQuery.items.length === 0 ? (
                <div
                  className={styles.subscribersEmpty}
                  data-testid="annual-fees-subscribers-empty"
                >
                  <Users size={22} aria-hidden />
                  <strong>
                    {t('admin.annualFees.subscribers.empty.title')}
                  </strong>
                  <span>{t('admin.annualFees.subscribers.empty.desc')}</span>
                </div>
              ) : (
                <ul
                  className={styles.subscribersList}
                  data-testid="annual-fees-subscribers-list"
                >
                  {subscribersQuery.items.map((s: AnnualFeeSubscriber) => (
                    <li
                      key={s.userId}
                      className={styles.subscriberRow}
                      data-testid={`annual-fees-subscriber-${s.userId}`}
                    >
                      <div className={styles.subscriberIdentity}>
                        <strong className={styles.subscriberName}>
                          {s.username}
                        </strong>
                        <span className={styles.subscriberRole}>{s.userRole}</span>
                      </div>
                      <div className={styles.subscriberExpiry}>
                        <span className={styles.subscriberExpiryLabel}>
                          {t('admin.annualFees.subscribers.expiry')}
                        </span>
                        <time
                          className={styles.subscriberExpiryValue}
                          dateTime={s.expiresAt ?? undefined}
                        >
                          {formatSubscriberExpiry(s.expiresAt ?? '')}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={closeSubscribersModal}
                data-testid="annual-fees-subscribers-done"
              >
                {t('admin.annualFees.subscribers.close')}
              </button>
            </div>
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
          confirmLabel={t('admin.annualFees.confirm.confirm')}
          cancelLabel={t('admin.annualFees.confirm.cancel')}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm((prev) => ({ ...prev, open: false }))}
        />
      )}
    </div>
  );
};

export default AnnualFees;

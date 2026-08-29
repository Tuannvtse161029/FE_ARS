import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  Loader,
  Layers,
} from 'lucide-react';
import { annualFeeService } from '../../services/annualFee.service';
import type {
  AnnualFeeDto,
  AnnualFeeCreateRequest,
  AnnualFeeUpdateRequest,
} from '../../types/annualFee';
import styles from './AnnualFees.module.css';

const ROLE_OPTIONS = ['Researcher', 'Lecturer'] as const;
const BILLING_CYCLES = [
  { value: 'Annual', label: 'Annual (12 months)' },
  { value: 'SixMonth', label: 'Six-month (6 months)' },
] as const;

const ROLE_LABEL: Record<string, string> = {
  Researcher: 'Researcher',
  Lecturer: 'Lecturer',
};

const formatCycle = (cycle: string | null | undefined): string => {
  if (cycle === 'Annual') return 'Annual (12 months)';
  if (cycle === 'SixMonth') return 'Six-month (6 months)';
  return cycle ?? '—';
};

const formatPrice = (priceVnd: number | null | undefined): string => {
  if (typeof priceVnd !== 'number') return '—';
  return `${priceVnd.toLocaleString('vi-VN')} VND`;
};

const AnnualFees = (): JSX.Element => {
  const [fees, setFees] = useState<AnnualFeeDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Busy states for specific item actions (toggle / delete)
  const [busyId, setBusyId] = useState<number | null>(null);

  // Create / Edit modal states
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingFeeId, setEditingFeeId] = useState<number | null>(null);

  const [formRole, setFormRole] = useState<string>('Researcher');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formPrice, setFormPrice] = useState<number | ''>(990000);
  const [formCycle, setFormCycle] = useState<string>('Annual');
  const [formFeatures, setFormFeatures] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await annualFeeService.listAnnualFees();
      setFees(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to load annual fees.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingFeeId(null);
    setFormRole('Researcher');
    setFormTitle('Researcher Annual Fee');
    setFormPrice(990000);
    setFormCycle('Annual');
    setFormFeatures('Full paper access\nPriority submission\nVerified researcher badge');
    setFormIsActive(true);
    setModalError(null);
  };

  const openEditModal = (fee: AnnualFeeDto) => {
    setModalMode('edit');
    setEditingFeeId(fee.id);
    setFormRole(fee.targetRole ?? 'Researcher');
    setFormTitle(fee.title ?? '');
    setFormPrice(fee.priceVnd ?? 0);
    setFormCycle(fee.billingCycle ?? 'Annual');
    setFormFeatures(Array.isArray(fee.features) ? fee.features.join('\n') : '');
    setFormIsActive(Boolean(fee.isActive));
    setModalError(null);
  };

  const closeModal = () => {
    if (modalSubmitting) return;
    setModalMode(null);
    setEditingFeeId(null);
  };

  const handleFormSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setModalError('Please enter a plan title.');
      return;
    }
    if (typeof formPrice !== 'number' || formPrice <= 0) {
      setModalError('Price must be a positive VND amount.');
      return;
    }

    const featuresList = formFeatures
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setModalSubmitting(true);
    setModalError(null);

    try {
      if (modalMode === 'create') {
        const payload: AnnualFeeCreateRequest = {
          targetRole: formRole,
          title: formTitle.trim(),
          priceVnd: Number(formPrice),
          billingCycle: formCycle,
          features: featuresList,
          isActive: formIsActive,
        };
        await annualFeeService.createAnnualFee(payload);
      } else if (modalMode === 'edit' && editingFeeId) {
        const payload: AnnualFeeUpdateRequest = {
          targetRole: formRole,
          title: formTitle.trim(),
          priceVnd: Number(formPrice),
          billingCycle: formCycle,
          features: featuresList,
          isActive: formIsActive,
        };
        await annualFeeService.updateAnnualFee(editingFeeId, payload);
      }
      setModalMode(null);
      await load();
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : 'Failed to save annual fee.',
      );
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleToggle = async (fee: AnnualFeeDto): Promise<void> => {
    if (busyId !== null) return;
    setBusyId(fee.id);
    try {
      await annualFeeService.toggleAnnualFee(fee.id);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to toggle fee status.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (fee: AnnualFeeDto): Promise<void> => {
    const ok = window.confirm(
      `Are you sure you want to delete "${fee.title}"? This cannot be undone.`,
    );
    if (!ok) return;

    setBusyId(fee.id);
    try {
      await annualFeeService.deleteAnnualFee(fee.id);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to delete fee tier.',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={styles.page} aria-labelledby="annual-fees-heading">
      <header className={styles.pageHeader}>
        <div>
          <h1 id="annual-fees-heading" className={styles.title}>
            Annual Fees & Subscriptions
          </h1>
          <p className={styles.subtitle}>
            Manage subscription tiers and pricing models offered to Researchers and Lecturers.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh fee tiers"
          >
            <RefreshCw
              size={14}
              className={loading ? styles.spinningIcon : undefined}
            />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            className={styles.createButton}
            onClick={openCreateModal}
          >
            <Plus size={16} />
            Add Fee Tier
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorState} role="alert">
          <AlertTriangle size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: '-2px' }} />
          Failed to load annual fees: {error}
        </div>
      )}

      {loading && fees.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <Loader size={20} className={styles.spinningIcon} style={{ margin: '0 auto 8px', display: 'block' }} />
          Loading annual fees…
        </div>
      ) : fees.length === 0 ? (
        <div className={styles.emptyState}>
          <Layers size={24} style={{ margin: '0 auto 8px', display: 'block', color: '#94a3b8' }} />
          No annual fee tiers configured yet. Click <strong>"Add Fee Tier"</strong> to create your first package.
        </div>
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
                <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => {
                const role = fee.targetRole ?? 'Unknown';
                const rowClass = fee.isActive === false ? styles.inactive : '';
                const isItemBusy = busyId === fee.id;

                return (
                  <tr
                    key={fee.id}
                    className={rowClass}
                    data-testid="annual-fees-row"
                    data-role={role}
                  >
                    <td>
                      <span className={styles.rolePill}>
                        {ROLE_LABEL[role] ?? role}
                      </span>
                    </td>
                    <td>
                      <strong>{fee.title ?? '—'}</strong>
                    </td>
                    <td>{formatPrice(fee.priceVnd)}</td>
                    <td>
                      <span className={styles.cycleBadge}>
                        {formatCycle(fee.billingCycle)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.featureChips}>
                        {Array.isArray(fee.features) && fee.features.length > 0 ? (
                          fee.features.map((feat, idx) => (
                            <span key={idx} className={styles.featureChip}>
                              {feat}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.toggleSwitch} ${
                          fee.isActive
                            ? styles.toggleSwitchActive
                            : styles.toggleSwitchInactive
                        }`}
                        onClick={() => void handleToggle(fee)}
                        disabled={isItemBusy}
                        title="Click to toggle active status"
                      >
                        {isItemBusy ? (
                          <Loader size={12} className={styles.spinningIcon} />
                        ) : fee.isActive ? (
                          'Active'
                        ) : (
                          'Inactive'
                        )}
                      </button>
                    </td>
                    <td>
                      <div className={styles.actionCell} style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => openEditModal(fee)}
                          disabled={isItemBusy}
                          title="Edit plan"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={() => void handleDelete(fee)}
                          disabled={isItemBusy}
                          title="Delete plan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE & EDIT MODAL */}
      {modalMode !== null && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="annualFeeModalTitle"
        >
          <div className={styles.modal}>
            <header className={styles.modalHeader}>
              <h2 id="annualFeeModalTitle" className={styles.modalTitle}>
                {modalMode === 'create' ? <Plus size={18} /> : <Pencil size={18} />}
                {modalMode === 'create' ? 'Create Annual Fee Tier' : 'Edit Annual Fee Tier'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={closeModal}
                disabled={modalSubmitting}
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleFormSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="targetRole">
                  Target Role
                </label>
                <select
                  id="targetRole"
                  className={styles.formSelect}
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  disabled={modalSubmitting}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="planTitle">
                  Plan Title
                </label>
                <input
                  id="planTitle"
                  type="text"
                  className={styles.formInput}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Researcher Annual Fee"
                  required
                  disabled={modalSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="priceVnd">
                  Price (VND)
                </label>
                <input
                  id="priceVnd"
                  type="number"
                  min="1"
                  step="1000"
                  className={styles.formInput}
                  value={formPrice}
                  onChange={(e) =>
                    setFormPrice(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                  placeholder="990000"
                  required
                  disabled={modalSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="billingCycle">
                  Billing Cycle
                </label>
                <select
                  id="billingCycle"
                  className={styles.formSelect}
                  value={formCycle}
                  onChange={(e) => setFormCycle(e.target.value)}
                  disabled={modalSubmitting}
                >
                  {BILLING_CYCLES.map((bc) => (
                    <option key={bc.value} value={bc.value}>
                      {bc.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="features">
                  Features (one per line)
                </label>
                <textarea
                  id="features"
                  className={styles.formTextarea}
                  rows={3}
                  value={formFeatures}
                  onChange={(e) => setFormFeatures(e.target.value)}
                  placeholder="Full paper download&#10;Priority review&#10;Verified badge"
                  disabled={modalSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    disabled={modalSubmitting}
                  />
                  Active (Available for checkout)
                </label>
              </div>

              {modalError && (
                <div className={styles.errorState} style={{ padding: '10px 14px', fontSize: 13 }}>
                  <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                  {modalError}
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeModal}
                  disabled={modalSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={modalSubmitting}
                >
                  {modalSubmitting ? (
                    <Loader size={14} className={styles.spinningIcon} />
                  ) : (
                    <Check size={14} />
                  )}
                  {modalSubmitting
                    ? 'Saving…'
                    : modalMode === 'create'
                    ? 'Create Plan'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default AnnualFees;
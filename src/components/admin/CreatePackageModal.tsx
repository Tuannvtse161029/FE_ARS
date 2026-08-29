import { useEffect, useState } from 'react';
import styles from './CreatePackageModal.module.css';
import type {
  PremiumPackageInput,
  PremiumPackageTargetRole,
  PremiumPackageBillingCycle,
} from '../../types/adminAuxiliary';

const ROLE_OPTIONS: Array<{ value: PremiumPackageTargetRole; label: string }> = [
  { value: 'RESEARCHER', label: 'Researcher' },
  { value: 'REVIEWER', label: 'Reviewer' },
  { value: 'LECTURER', label: 'Lecturer' },
];

const CYCLE_OPTIONS: Array<{ value: PremiumPackageBillingCycle; label: string }> = [
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Yearly', label: 'Yearly' },
];

interface CreatePackageModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: (input: PremiumPackageInput) => Promise<void> | void;
}

interface FormState {
  title: string;
  targetRole: PremiumPackageTargetRole;
  priceVnd: number;
  billingCycle: PremiumPackageBillingCycle;
  features: string[];
  isActive: boolean;
}

const empty = (): FormState => ({
  title: '',
  targetRole: 'RESEARCHER',
  priceVnd: 0,
  billingCycle: 'Monthly',
  features: [''],
  isActive: true,
});

export function CreatePackageModal({
  isOpen,
  isSubmitting,
  errorMessage,
  onClose,
  onConfirm,
}: CreatePackageModalProps): JSX.Element | null {
  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    if (isOpen) setForm(empty());
  }, [isOpen]);

  if (!isOpen) return null;

  const updateFeature = (idx: number, value: string): void => {
    setForm((prev) => {
      const next = [...prev.features];
      next[idx] = value;
      return { ...prev, features: next };
    });
  };
  const removeFeature = (idx: number): void => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.length > 1 ? prev.features.filter((_, i) => i !== idx) : [''],
    }));
  };
  const addFeature = (): void => {
    setForm((prev) => ({ ...prev, features: [...prev.features, ''] }));
  };

  const valid =
    form.title.trim().length > 0 &&
    Number.isFinite(form.priceVnd) &&
    form.priceVnd >= 0 &&
    form.features.some((f) => f.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!valid) return;
    const payload: PremiumPackageInput = {
      title: form.title.trim(),
      targetRole: form.targetRole,
      priceVnd: Number(form.priceVnd),
      billingCycle: form.billingCycle,
      features: form.features.map((f) => f.trim()).filter(Boolean),
      isActive: form.isActive,
    };
    await onConfirm(payload);
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-package-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 id="create-package-title" className={styles.title}>
            Create Package
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.body}>
            <div className={styles.fieldRow}>
              <label className={styles.label} htmlFor="pkg-title">
                Package Title
              </label>
              <input
                id="pkg-title"
                type="text"
                className={styles.input}
                placeholder="e.g. Researcher Premium Annual"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.fieldRowSplit}>
              <div>
                <label className={styles.label} htmlFor="pkg-role">
                  Target User Role
                </label>
                <select
                  id="pkg-role"
                  className={styles.select}
                  value={form.targetRole}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      targetRole: e.target.value as PremiumPackageTargetRole,
                    }))
                  }
                  disabled={isSubmitting}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.label} htmlFor="pkg-cycle">
                  Billing Cycle
                </label>
                <select
                  id="pkg-cycle"
                  className={styles.select}
                  value={form.billingCycle}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      billingCycle: e.target.value as PremiumPackageBillingCycle,
                    }))
                  }
                  disabled={isSubmitting}
                >
                  {CYCLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.label} htmlFor="pkg-price">
                Price (VND)
              </label>
              <input
                id="pkg-price"
                type="number"
                min={0}
                className={styles.input}
                placeholder="0"
                value={Number.isFinite(form.priceVnd) ? form.priceVnd : ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priceVnd: e.target.value === '' ? 0 : Number(e.target.value),
                  }))
                }
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.label}>Features</span>
              <div className={styles.featuresList}>
                {form.features.map((feature, idx) => (
                  <div key={idx} className={styles.featureRow}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder={`Feature ${idx + 1}`}
                      value={feature}
                      onChange={(e) => updateFeature(idx, e.target.value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className={styles.removeFeatureButton}
                      onClick={() => removeFeature(idx)}
                      disabled={isSubmitting || form.features.length === 1}
                      aria-label={`Remove feature ${idx + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.addFeatureButton}
                  onClick={addFeature}
                  disabled={isSubmitting}
                >
                  <span aria-hidden>＋</span>
                  Add Feature Item
                </button>
              </div>
            </div>

            <div className={styles.toggleRow}>
              <span className={styles.label}>Status</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                className={`${styles.toggle} ${form.isActive ? styles.toggleOn : ''}`}
                onClick={() =>
                  setForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                }
                disabled={isSubmitting}
              >
                <span className={styles.toggleKnob} />
                <span className={styles.toggleLabel}>
                  {form.isActive ? 'Active' : 'Inactive'}
                </span>
              </button>
            </div>
          </div>

          {errorMessage ? (
            <p role="alert" className={styles.error}>
              {errorMessage}
            </p>
          ) : null}

          <footer className={styles.footer}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.confirmButton}
              disabled={isSubmitting || !valid}
            >
              {isSubmitting ? 'Saving…' : 'Save & Publish Package'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default CreatePackageModal;
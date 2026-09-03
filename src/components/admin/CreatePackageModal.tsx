import { useEffect, useRef, useState } from 'react';

const useLocalDialogFocus = (open: boolean, busy: boolean, onClose: () => void) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) { openerRef.current?.focus(); return; }
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]')?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'));
      if (!focusable.length) return;
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      if (index === 0 && event.shiftKey) { event.preventDefault(); focusable[focusable.length - 1].focus(); } else if (index === focusable.length - 1 && !event.shiftKey) { event.preventDefault(); focusable[0].focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', handleKeyDown); };
  }, [open, busy, onClose]);
  return dialogRef;
};
import styles from './CreatePackageModal.module.css';
import type {
  PremiumPackageInput,
  PremiumPackageTargetRole,
  PremiumPackageBillingCycle,
} from '../../types/adminAuxiliary';

const ROLE_OPTIONS: Array<{ value: PremiumPackageTargetRole; label: string }> = [
  { value: 'RESEARCHER', label: 'Researcher' },
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
  isActive: boolean;
}

const empty = (): FormState => ({
  title: '',
  targetRole: 'RESEARCHER',
  priceVnd: 0,
  billingCycle: 'Yearly',
  isActive: true,
});

export function CreatePackageModal({
  isOpen,
  isSubmitting,
  errorMessage,
  onClose,
  onConfirm,
}: CreatePackageModalProps): JSX.Element | null {
  const dialogRef = useLocalDialogFocus(isOpen, isSubmitting, onClose);
  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    if (isOpen) setForm(empty());
  }, [isOpen]);

  if (!isOpen) return null;

  const valid =
    form.title.trim().length > 0 &&
    Number.isFinite(form.priceVnd) &&
    form.priceVnd >= 0;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!valid) return;
    const payload: PremiumPackageInput = {
      title: form.title.trim(),
      targetRole: form.targetRole,
      priceVnd: Number(form.priceVnd),
      billingCycle: form.billingCycle,
      features: [],
      isActive: form.isActive,
    };
    await onConfirm(payload);
  };

  return (
    <div
      ref={dialogRef}
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
            Create Annual Fees
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
                Package title
              </label>
              <input
                id="pkg-title"
                type="text"
                className={styles.input}
                placeholder="e.g. Researcher Annual Fee"
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
              {isSubmitting ? 'Saving…' : 'Create Annual Fees'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default CreatePackageModal;
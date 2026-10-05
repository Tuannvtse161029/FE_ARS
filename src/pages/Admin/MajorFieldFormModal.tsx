/**
 * MajorFieldFormModal — shared create/edit modal for MajorField entries.
 *
 * Used by AdminMajorFields. The component does NOT own the data — it
 * delegates to `fieldService.createMajor` / `fieldService.updateMajor` and
 * calls back into the parent via `onSuccess()` so the parent can refetch
 * the list and close the modal in a single render.
 *
 * Design notes:
 *   - One modal covers both create AND edit. The parent passes `mode`
 *     and an optional `target`. Switching mode on the same instance is
 *     supported; the form resets via a `useEffect`.
 *   - Validation is inline (no native dialogs). The Submit button is
 *     disabled while a save is in flight to avoid double-submits.
 *   - On BE error we surface the server's message if axios provided one
 *     (the .NET controllers serialise their problem-details responses
 *     as `{ message: string }`); otherwise we fall back to a generic
 *     i18n string.
 *   - We reuse the shared AdminDialog tokens (.overlay / .modal / etc.)
 *     so the modal visually matches CreateSubFieldModal.
 */
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../../i18n/I18nContext';
import { fieldService } from '../../services/field.service';
import type { MajorField } from '../../types/domain';
import dialogStyles from './AdminDialog.module.css';
import styles from './CreateSubFieldModal.module.css';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  target?: MajorField | null;
  onClose: () => void;
  onSuccess: () => void;
}

const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;

interface FieldErrors {
  name?: string;
}

const extractAxiosMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) {
    // The platform's axios wrapper copies the BE's `{ message }` body
    // onto `error.message` for non-2xx responses, so this is the common path.
    return err.message || fallback;
  }
  return fallback;
};

export const MajorFieldFormModal = ({
  open,
  mode,
  target,
  onClose,
  onSuccess,
}: Props) => {
  const { t } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Hydrate / reset the form when the modal opens or the target changes.
  // Edits prefill from `target`, creates start blank.
  useEffect(() => {
    if (!open) return;
    setName(mode === 'edit' && target ? target.name : '');
    setDescription(
      mode === 'edit' && target?.description ? target.description : '',
    );
    setErrors({});
  }, [open, mode, target]);

  // Escape key closes the modal unless a save is in flight.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, saving]);

  if (!open) return null;

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmed = name.trim();
    if (!trimmed) {
      next.name = t(
        'admin.majorFields.error.nameRequired',
        'Name is required.',
      );
    } else if (trimmed.length > NAME_MAX) {
      next.name = t(
        'admin.majorFields.error.nameTooLong',
        'Name must be {max} characters or fewer.',
        { max: NAME_MAX },
      );
    }
    return next;
  };

  const handleSave = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
    };

    try {
      if (mode === 'edit' && target) {
        await fieldService.updateMajor(target.id, payload);
        toast.success(
          t(
            'admin.majorFields.toast.updateSuccess',
            'Major field updated successfully.',
          ),
        );
      } else {
        await fieldService.createMajor(payload);
        toast.success(
          t(
            'admin.majorFields.toast.createSuccess',
            'Major field created successfully.',
          ),
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      const fallback =
        mode === 'edit'
          ? t(
              'admin.majorFields.toast.updateError',
              'Failed to update major field. Please try again.',
            )
          : t(
              'admin.majorFields.toast.createError',
              'Failed to create major field. Please try again.',
            );
      toast.error(extractAxiosMessage(err, fallback));
    } finally {
      setSaving(false);
    }
  };

  const titleKey =
    mode === 'edit'
      ? 'admin.majorFields.modal.editTitle'
      : 'admin.majorFields.modal.createTitle';
  const titleFallback =
    mode === 'edit' ? 'Edit major field' : 'Create major field';

  return (
    <div
      ref={overlayRef}
      className={dialogStyles.overlay}
      onClick={(event) => {
        if (event.target === overlayRef.current && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="major-field-form-modal-title"
      data-testid="major-field-form-modal"
    >
      <div
        className={`${dialogStyles.modal} ${styles.modal}`}
        role="document"
      >
        <div className={dialogStyles.header}>
          <h2
            className={dialogStyles.title}
            id="major-field-form-modal-title"
          >
            {t(titleKey, titleFallback)}
          </h2>
          <button
            type="button"
            className={dialogStyles.iconButton}
            onClick={() => !saving && onClose()}
            aria-label={t('common.close', 'Close')}
            disabled={saving}
            data-testid="major-field-form-close"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="major-field-name">
              {t('admin.majorFields.field.name', 'Name')}
              <span className={styles.required} aria-hidden>
                *
              </span>
            </label>
            <input
              id="major-field-name"
              type="text"
              className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
              value={name}
              maxLength={NAME_MAX + 1}
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name) {
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              disabled={saving}
              autoFocus
              data-testid="major-field-form-name"
            />
            {errors.name && (
              <p
                className={styles.fieldError}
                role="alert"
                data-testid="major-field-form-name-error"
              >
                {errors.name}
              </p>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="major-field-description">
              {t('admin.majorFields.field.description', 'Description')}
              <span
                style={{ color: 'var(--ars-ink-muted)', marginLeft: 6, fontWeight: 'normal' }}
              >
                ({t('admin.majorFields.field.optional', 'optional')})
              </span>
            </label>
            <textarea
              id="major-field-description"
              className={dialogStyles.textarea}
              value={description}
              maxLength={DESCRIPTION_MAX + 1}
              onChange={(event) => setDescription(event.target.value)}
              disabled={saving}
              rows={3}
              data-testid="major-field-form-description"
            />
            <span className={dialogStyles.counter}>
              {description.length.toLocaleString()} / {DESCRIPTION_MAX.toLocaleString()}
            </span>
          </div>
        </div>

        <div className={dialogStyles.footer}>
          <button
            type="button"
            className={`${dialogStyles.button} ${dialogStyles.secondaryButton}`}
            onClick={() => !saving && onClose()}
            disabled={saving}
            data-testid="major-field-form-cancel"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={`${dialogStyles.button} ${dialogStyles.primaryButton}`}
            onClick={() => void handleSave()}
            disabled={saving}
            data-testid="major-field-form-save"
          >
            {saving
              ? t('common.saving', 'Saving…')
              : mode === 'edit'
                ? t('admin.majorFields.modal.saveUpdate', 'Save changes')
                : t('admin.majorFields.modal.saveCreate', 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MajorFieldFormModal;
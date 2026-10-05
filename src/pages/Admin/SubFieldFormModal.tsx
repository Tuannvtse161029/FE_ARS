/**
 * SubFieldFormModal — shared create/edit modal for SubField entries.
 *
 * Used by AdminSubFields. Same shape as MajorFieldFormModal but adds a
 * Major-field `<select>` populated from `getAllMajor()`. The select is
 * disabled while the majors list is loading to avoid showing an empty
 * picker that the admin could submit accidentally.
 *
 * Notes:
 *   - On create we require a valid majorFieldId (the BE rejects a 0/null
 *     value with a 400). On edit we send whatever the admin picked.
 *   - The select stays enabled in edit mode even if `loadingMajors` is
 *     true, since the current `target.majorFieldId` may not yet be in the
 *     freshly fetched list (e.g. if the admin deleted the major earlier
 *     in the same session). The validation step catches missing values.
 */
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '../../i18n/I18nContext';
import { fieldService } from '../../services/field.service';
import type { MajorField, SubField } from '../../types/domain';
import { isValidEntityId } from '../../utils/entityId';
import dialogStyles from './AdminDialog.module.css';
import styles from './CreateSubFieldModal.module.css';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  target?: SubField | null;
  onClose: () => void;
  onSuccess: () => void;
}

const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;

interface FieldErrors {
  majorFieldId?: string;
  name?: string;
}

const extractAxiosMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
};

export const SubFieldFormModal = ({
  open,
  mode,
  target,
  onClose,
  onSuccess,
}: Props) => {
  const { t } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [majors, setMajors] = useState<MajorField[]>([]);
  const [loadingMajors, setLoadingMajors] = useState(false);
  const [majorFieldId, setMajorFieldId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Fetch the major-fields list every time the modal opens so a freshly
  // created major field appears in the dropdown without needing a manual
  // refresh. Cache-first; ~ms on repeat opens.
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoadingMajors(true);
    fieldService
      .getAllMajor()
      .then((data) => {
        if (active) setMajors(data);
      })
      .catch(() => {
        if (active) {
          toast.error(
            t(
              'admin.subFields.error.loadMajorsFailed',
              'Failed to load major fields. Please close and retry.',
            ),
          );
        }
      })
      .finally(() => {
        if (active) setLoadingMajors(false);
      });
    return () => {
      active = false;
    };
  }, [open, t]);

  // Hydrate / reset the form when the modal opens or the target changes.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && target) {
      setMajorFieldId(target.majorFieldId);
      setName(target.name);
      setDescription(target.description ?? '');
    } else {
      setMajorFieldId('');
      setName('');
      setDescription('');
    }
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
    if (!isValidEntityId(majorFieldId)) {
      next.majorFieldId = t(
        'admin.subFields.error.majorRequired',
        'Select a major field.',
      );
    }
    const trimmed = name.trim();
    if (!trimmed) {
      next.name = t(
        'admin.subFields.error.nameRequired',
        'Name is required.',
      );
    } else if (trimmed.length > NAME_MAX) {
      next.name = t(
        'admin.subFields.error.nameTooLong',
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
      majorFieldId: Number(majorFieldId),
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
    };

    try {
      if (mode === 'edit' && target) {
        await fieldService.updateSub(target.id, payload);
        toast.success(
          t(
            'admin.subFields.toast.updateSuccess',
            'Sub-field updated successfully.',
          ),
        );
      } else {
        await fieldService.createSub(payload);
        toast.success(
          t(
            'admin.subFields.toast.createSuccess',
            'Sub-field created successfully.',
          ),
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      const fallback =
        mode === 'edit'
          ? t(
              'admin.subFields.toast.updateError',
              'Failed to update sub-field. Please try again.',
            )
          : t(
              'admin.subFields.toast.createError',
              'Failed to create sub-field. Please try again.',
            );
      toast.error(extractAxiosMessage(err, fallback));
    } finally {
      setSaving(false);
    }
  };

  const titleKey =
    mode === 'edit'
      ? 'admin.subFields.modal.editTitle'
      : 'admin.subFields.modal.createTitle';
  const titleFallback = mode === 'edit' ? 'Edit sub-field' : 'Create sub-field';

  return (
    <div
      ref={overlayRef}
      className={dialogStyles.overlay}
      onClick={(event) => {
        if (event.target === overlayRef.current && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-field-form-modal-title"
      data-testid="sub-field-form-modal"
    >
      <div
        className={`${dialogStyles.modal} ${styles.modal}`}
        role="document"
      >
        <div className={dialogStyles.header}>
          <h2
            className={dialogStyles.title}
            id="sub-field-form-modal-title"
          >
            {t(titleKey, titleFallback)}
          </h2>
          <button
            type="button"
            className={dialogStyles.iconButton}
            onClick={() => !saving && onClose()}
            aria-label={t('common.close', 'Close')}
            disabled={saving}
            data-testid="sub-field-form-close"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="sub-field-major">
              {t('admin.subFields.field.major', 'Major field')}
              <span className={styles.required} aria-hidden>
                *
              </span>
            </label>
            <select
              id="sub-field-major"
              className={`${styles.select} ${errors.majorFieldId ? styles.selectError : ''}`}
              value={majorFieldId}
              onChange={(event) => {
                const val = event.target.value ? Number(event.target.value) : '';
                setMajorFieldId(val);
                if (errors.majorFieldId) {
                  setErrors((prev) => ({ ...prev, majorFieldId: undefined }));
                }
              }}
              // Disable while loading so we never let the admin pick an
              // empty placeholder and submit. Edit mode allows saving
              // even when the list is mid-refresh — validation will
              // still catch a cleared value.
              disabled={(loadingMajors && mode === 'create') || saving}
              data-testid="sub-field-form-major"
            >
              <option value="">
                {loadingMajors && mode === 'create'
                  ? t('common.loading', 'Loading…')
                  : t(
                      'admin.subFields.field.majorPlaceholder',
                      'Select major field…',
                    )}
              </option>
              {majors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {errors.majorFieldId && (
              <p
                className={styles.fieldError}
                role="alert"
                data-testid="sub-field-form-major-error"
              >
                {errors.majorFieldId}
              </p>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="sub-field-name">
              {t('admin.subFields.field.name', 'Name')}
              <span className={styles.required} aria-hidden>
                *
              </span>
            </label>
            <input
              id="sub-field-name"
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
              data-testid="sub-field-form-name"
            />
            {errors.name && (
              <p
                className={styles.fieldError}
                role="alert"
                data-testid="sub-field-form-name-error"
              >
                {errors.name}
              </p>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="sub-field-description">
              {t('admin.subFields.field.description', 'Description')}
              <span
                style={{ color: 'var(--ars-ink-muted)', marginLeft: 6, fontWeight: 'normal' }}
              >
                ({t('admin.subFields.field.optional', 'optional')})
              </span>
            </label>
            <textarea
              id="sub-field-description"
              className={dialogStyles.textarea}
              value={description}
              maxLength={DESCRIPTION_MAX + 1}
              onChange={(event) => setDescription(event.target.value)}
              disabled={saving}
              rows={3}
              data-testid="sub-field-form-description"
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
            data-testid="sub-field-form-cancel"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={`${dialogStyles.button} ${dialogStyles.primaryButton}`}
            onClick={() => void handleSave()}
            disabled={saving}
            data-testid="sub-field-form-save"
          >
            {saving
              ? t('common.saving', 'Saving…')
              : mode === 'edit'
                ? t('admin.subFields.modal.saveUpdate', 'Save changes')
                : t('admin.subFields.modal.saveCreate', 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubFieldFormModal;
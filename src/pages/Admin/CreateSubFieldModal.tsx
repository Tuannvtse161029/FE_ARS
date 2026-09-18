/**
 * CreateSubFieldModal — ARS Research Constellation
 *
 * Modal allowing Admin to create a new SubField and optionally
 * initialize its GradingRubric using the system standard template.
 */
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import { fieldService } from '../../services/field.service';
import type { MajorField } from '../../types/domain';
import { getSystemDefaultRubric } from './defaultRubricTemplate';
import dialogStyles from './AdminDialog.module.css';
import styles from './CreateSubFieldModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateSubFieldModal = ({ open, onClose, onSuccess }: Props) => {
  const { t } = useI18n();
  const locale = useLocale();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [majors, setMajors] = useState<MajorField[]>([]);
  const [loadingMajors, setLoadingMajors] = useState(false);
  const [majorFieldId, setMajorFieldId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initDefaultRubric, setInitDefaultRubric] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ majorFieldId?: string; name?: string }>({});

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingMajors(true);
    fieldService
      .getAllMajor()
      .then((data) => {
        if (active) setMajors(data);
      })
      .catch(() => {
        if (active) toast.error(t('common.error', 'Failed to load major fields.'));
      })
      .finally(() => {
        if (active) setLoadingMajors(false);
      });

    // Reset form
    setMajorFieldId('');
    setName('');
    setDescription('');
    setInitDefaultRubric(true);
    setErrors({});

    return () => {
      active = false;
    };
  }, [open, t]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const validate = () => {
    const errs: { majorFieldId?: string; name?: string } = {};
    if (!majorFieldId || typeof majorFieldId !== 'number' || majorFieldId <= 0) {
      errs.majorFieldId = t('admin.rubric.error.required', 'This field is required.');
    }
    if (!name.trim()) {
      errs.name = t('admin.rubric.error.required', 'This field is required.');
    }
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const created = await fieldService.createSub({
        majorFieldId: Number(majorFieldId),
        name: name.trim(),
        description: description.trim() || null,
      });

      if (initDefaultRubric && created?.id) {
        try {
          const defaultRubric = getSystemDefaultRubric(locale);
          await fieldService.patchRubric(created.id, defaultRubric);
        } catch {
          // SubField was created; rubric init failure is non-fatal
          console.warn('Failed to initialize default rubric for created subfield');
        }
      }

      toast.success(
        t('admin.rubric.toast.createSuccess', 'Sub-field created successfully.'),
      );
      onSuccess();
      onClose();
    } catch {
      toast.error(
        t('admin.rubric.toast.createError', 'Failed to create sub-field. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className={dialogStyles.overlay}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={`${dialogStyles.modal} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className={dialogStyles.header}>
          <div>
            <h2 className={dialogStyles.title}>
              {t('admin.rubric.createModal.title', 'Create New Sub-field')}
            </h2>
          </div>
          <button
            type="button"
            className={dialogStyles.iconButton}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Major Field Select */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              {t('admin.rubric.createModal.majorField', 'Major Field')}
              <span className={styles.required}>*</span>
            </label>
            <select
              className={`${styles.select} ${errors.majorFieldId ? styles.selectError : ''}`}
              value={majorFieldId}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : '';
                setMajorFieldId(val);
                if (errors.majorFieldId) {
                  setErrors((prev) => ({ ...prev, majorFieldId: undefined }));
                }
              }}
              disabled={loadingMajors || saving}
            >
              <option value="">
                {loadingMajors
                  ? t('common.loading', 'Loading…')
                  : t('admin.rubric.createModal.majorFieldPlaceholder', 'Select major field…')}
              </option>
              {majors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {errors.majorFieldId && (
              <span className={styles.fieldError}>{errors.majorFieldId}</span>
            )}
          </div>

          {/* SubField Name */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              {t('admin.rubric.createModal.subFieldName', 'Sub-field Name')}
              <span className={styles.required}>*</span>
            </label>
            <input
              className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
              type="text"
              placeholder={t(
                'admin.rubric.createModal.subFieldNamePlaceholder',
                'e.g. Artificial Intelligence…',
              )}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) {
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              disabled={saving}
            />
            {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
          </div>

          {/* Description */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              {t('admin.rubric.createModal.description', 'Description (optional)')}
            </label>
            <textarea
              className={dialogStyles.textarea}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Init default rubric checkbox */}
          <label className={styles.checkboxCard}>
            <input
              type="checkbox"
              className={styles.checkboxInput}
              checked={initDefaultRubric}
              onChange={(e) => setInitDefaultRubric(e.target.checked)}
              disabled={saving}
            />
            <div className={styles.checkboxLabelCluster}>
              <span className={styles.checkboxTitle}>
                {t(
                  'admin.rubric.createModal.initRubric',
                  'Initialize standard grading rubric (5 criteria, 100 pts total)',
                )}
              </span>
              <span className={styles.checkboxDesc}>
                {t(
                  'admin.rubric.createModal.initRubricDesc',
                  'Automatically generates Novelty, Methodology, Impact, Presentation, and Ethics criteria so reviewers can evaluate papers immediately.',
                )}
              </span>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className={dialogStyles.footer}>
          <button
            type="button"
            className={`${dialogStyles.button} ${dialogStyles.secondaryButton}`}
            onClick={onClose}
            disabled={saving}
          >
            {t('admin.rubric.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={`${dialogStyles.button} ${dialogStyles.primaryButton}`}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving
              ? t('admin.rubric.createModal.submitting', 'Creating…')
              : t('admin.rubric.createModal.submit', 'Create Sub-field')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSubFieldModal;

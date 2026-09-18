/**
 * GradingRubricModal — ARS Research Constellation
 *
 * Modal for Admin to view or edit the GradingRubric (scoring criteria)
 * of a SubField. Supports two modes:
 *   - "system"  : read-only preview of existing criteria
 *   - "custom"  : editable dynamic rows with validation
 *
 * On save, calls PATCH /api/SubField/{id}/rubric via fieldService.patchRubric().
 */
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import { fieldService } from '../../services/field.service';
import type { GradingRubricCriterion } from '../../types/domain';
import { getSystemDefaultRubric } from './defaultRubricTemplate';
import dialogStyles from './AdminDialog.module.css';
import styles from './GradingRubricModal.module.css';

const CODE_REGEX = /^[A-Z0-9_]+$/;
const MAX_SCORE_MIN = 1;

interface RubricRow extends GradingRubricCriterion {
  _id: number;            // stable UI key; not sent to BE
  _codeChanged: boolean;  // tracks if code was changed from initial
}

interface ValidationErrors {
  noRows?: string;
  rows: Record<number, { code?: string; title?: string; maxScore?: string }>;
  dupCodes: string[];
}

interface Props {
  subFieldId: number;
  subFieldName: string;
  initialRubric: GradingRubricCriterion[];
  open: boolean;
  onClose: () => void;
  onSaved: (updated: GradingRubricCriterion[]) => void;
}

let _nextId = 1;
const nextId = () => _nextId++;

const makeRow = (c: GradingRubricCriterion, originalCode: string): RubricRow => ({
  ...c,
  _id: nextId(),
  _codeChanged: false,
  // Store original code ref in a closure variable for change-detection on edits
  // by comparing against originalCode
  _originalCode: originalCode,
} as RubricRow & { _originalCode: string });

const blankRow = (order: number): RubricRow => ({
  _id: nextId(),
  code: '',
  title: '',
  description: '',
  maxScore: 10,
  order,
  standardReferences: [],
  _codeChanged: false,
  _originalCode: '',
} as RubricRow & { _originalCode: string });

const GradingRubricModal = ({
  subFieldId,
  subFieldName,
  initialRubric,
  open,
  onClose,
  onSaved,
}: Props) => {
  const { t } = useI18n();
  const locale = useLocale();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<'system' | 'custom'>('system');
  const [rows, setRows] = useState<(RubricRow & { _originalCode: string })[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({ rows: {}, dupCodes: [] });
  const [refInputs, setRefInputs] = useState<Record<number, string>>({});

  const handleApplySystemTemplate = () => {
    if (rows.length > 0) {
      const confirmed = window.confirm(
        t(
          'admin.rubric.confirmApplyTemplate',
          'This will replace all criteria with the system standard template (5 criteria, 100 pts total). Continue?',
        ),
      );
      if (!confirmed) return;
    }
    const defaultCriteria = getSystemDefaultRubric(locale);
    const mapped = defaultCriteria.map((c) =>
      makeRow(c, ''),
    ) as (RubricRow & { _originalCode: string })[];
    setRows(mapped);
    setMode('custom');
    setErrors({ rows: {}, dupCodes: [] });
  };

  // Initialise rows whenever the modal opens or initialRubric changes
  useEffect(() => {
    if (!open) return;
    const sorted = [...initialRubric].sort((a, b) => a.order - b.order);
    const mapped = sorted.map((c) => makeRow(c, c.code)) as (RubricRow & { _originalCode: string })[];
    setRows(mapped);
    setMode('system');
    setErrors({ rows: {}, dupCodes: [] });
    setRefInputs({});
  }, [open, initialRubric]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): ValidationErrors => {
    const errs: ValidationErrors = { rows: {}, dupCodes: [] };
    if (rows.length === 0) {
      errs.noRows = t('admin.rubric.error.noRows', 'Add at least one criterion.');
      return errs;
    }
    const codeSeen: Record<string, number[]> = {};
    rows.forEach((r) => {
      const rowErrs: { code?: string; title?: string; maxScore?: string } = {};
      if (!r.code.trim()) {
        rowErrs.code = t('admin.rubric.error.required', 'This field is required.');
      } else if (!CODE_REGEX.test(r.code)) {
        rowErrs.code = t('admin.rubric.error.invalidCode', 'Code must only contain A-Z, 0-9, and _ (uppercase).');
      } else {
        if (!codeSeen[r.code]) codeSeen[r.code] = [];
        codeSeen[r.code]!.push(r._id);
      }
      if (!r.title.trim()) {
        rowErrs.title = t('admin.rubric.error.required', 'This field is required.');
      }
      const ms = Number(r.maxScore);
      if (!Number.isInteger(ms) || ms < MAX_SCORE_MIN) {
        rowErrs.maxScore = t('admin.rubric.error.maxScore', 'Max score must be a positive integer.');
      }
      if (Object.keys(rowErrs).length > 0) errs.rows[r._id] = rowErrs;
    });
    // Detect duplicates
    Object.entries(codeSeen).forEach(([code, ids]) => {
      if (ids.length > 1) {
        errs.dupCodes.push(code);
        ids.forEach((id) => {
          errs.rows[id] = {
            ...errs.rows[id],
            code: t('admin.rubric.error.dupCode', 'Code "{code}" is duplicated within this sub-field.', { code }),
          };
        });
      }
    });
    return errs;
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleFieldChange = (
    id: number,
    field: keyof GradingRubricCriterion,
    value: string | number | string[],
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'code') {
          updated._codeChanged = r._originalCode !== '' && String(value) !== r._originalCode;
        }
        return updated;
      }),
    );
    // Clear field error on change
    setErrors((prev) => {
      if (!prev.rows[id]) return prev;
      const rowErrs = { ...prev.rows[id] };
      delete rowErrs[field as keyof typeof rowErrs];
      return { ...prev, rows: { ...prev.rows, [id]: rowErrs } };
    });
  };

  const handleAddRow = () => {
    const nextOrder = rows.length + 1;
    setRows((prev) => [...prev, blankRow(nextOrder) as (RubricRow & { _originalCode: string })]);
  };

  const handleDeleteRow = (id: number) => {
    const confirmed = window.confirm(
      t('admin.rubric.confirm.delete', 'Removing this criterion may affect existing reviews. Continue?'),
    );
    if (!confirmed) return;
    setRows((prev) => {
      const next = prev.filter((r) => r._id !== id);
      return next.map((r, i) => ({ ...r, order: i + 1 }));
    });
    setErrors((prev) => {
      const rows = { ...prev.rows };
      delete rows[id];
      return { ...prev, rows };
    });
  };

  const handleRefKeyDown = (id: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = (refInputs[id] ?? '').trim();
      if (!val) return;
      setRows((prev) =>
        prev.map((r) =>
          r._id === id
            ? { ...r, standardReferences: [...r.standardReferences, val] }
            : r,
        ),
      );
      setRefInputs((prev) => ({ ...prev, [id]: '' }));
    }
  };

  const handleRemoveRef = (id: number, ref: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r._id === id
          ? { ...r, standardReferences: r.standardReferences.filter((x) => x !== ref) }
          : r,
      ),
    );
  };

  const handleSave = async () => {
    const errs = validate();
    setErrors(errs);
    if (
      errs.noRows ||
      Object.keys(errs.rows).some((k) => Object.keys(errs.rows[Number(k)] ?? {}).length > 0) ||
      errs.dupCodes.length > 0
    ) {
      return;
    }

    const payload: GradingRubricCriterion[] = rows.map((r, i) => ({
      code: r.code.trim(),
      title: r.title.trim(),
      description: r.description.trim(),
      maxScore: Number(r.maxScore),
      order: i + 1,
      standardReferences: r.standardReferences,
    }));

    setSaving(true);
    try {
      await fieldService.patchRubric(subFieldId, payload);
      toast.success(t('admin.rubric.toast.success', 'GradingRubric updated successfully.'));
      onSaved(payload);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast.error(t('admin.rubric.toast.403', 'You do not have permission to perform this action.'));
      } else if (status === 404) {
        toast.error(t('admin.rubric.toast.404', 'SubField not found.'));
      } else {
        toast.error(t('admin.rubric.toast.error', 'Failed to save GradingRubric. Please try again.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const totalMaxScore = rows.reduce((sum, r) => sum + (Number(r.maxScore) || 0), 0);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      className={dialogStyles.overlay}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`${dialogStyles.modal} ${styles.wideModal}`} role="dialog" aria-modal="true">
        {/* Header */}
        <div className={dialogStyles.header}>
          <div>
            <h2 className={dialogStyles.title}>
              {t('admin.rubric.modal.title', 'GradingRubric \u2014 {name}', { name: subFieldName })}
            </h2>
            <p className={dialogStyles.subtitle}>ID: {subFieldId}</p>
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

        {/* Mode toggle */}
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'system' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('system')}
          >
            {t('admin.rubric.sourceSystem', 'Use system template (read-only preview)')}
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'custom' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('custom')}
          >
            {t('admin.rubric.sourceCustom', 'Edit manually')}
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Global errors */}
          {errors.noRows && (
            <div className={dialogStyles.error}>
              <AlertTriangle size={14} />
              {errors.noRows}
            </div>
          )}

          {/* Read-only system preview */}
          {mode === 'system' && (
            <div className={styles.readonlyWrap}>
              {rows.length === 0 ? (
                <div className={styles.emptyTemplateWrap}>
                  <p className={styles.readonlyEmpty}>
                    {t(
                      'admin.rubric.readonly.empty',
                      'No rubric criteria have been defined for this sub-field yet.',
                    )}
                  </p>
                  <button
                    type="button"
                    className={styles.initTemplateBtn}
                    onClick={handleApplySystemTemplate}
                  >
                    <Sparkles size={15} />
                    {t(
                      'admin.rubric.initFromTemplate',
                      'Initialize Rubric from System Template',
                    )}
                  </button>
                </div>
              ) : (
                rows.map((r, i) => (
                  <div key={r._id} className={styles.readonlyRow}>
                    <div className={styles.readonlyOrder}>{i + 1}</div>
                    <div className={styles.readonlyContent}>
                      <div className={styles.readonlyHeader}>
                        <code className={styles.codeTag}>{r.code}</code>
                        <span className={styles.readonlyTitle}>{r.title}</span>
                        <span className={styles.scoreTag}>{r.maxScore} pts</span>
                      </div>
                      {r.description && (
                        <p className={styles.readonlyDesc}>{r.description}</p>
                      )}
                      {r.standardReferences.length > 0 && (
                        <div className={styles.refPills}>
                          {r.standardReferences.map((ref) => (
                            <span key={ref} className={styles.refPill}>{ref}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Editable mode */}
          {mode === 'custom' && (
            <>
              {/* Total score bar */}
              <div className={styles.totalBar}>
                <span>
                  {t('admin.rubric.totalScore', 'Total max score: {total}', { total: totalMaxScore })}
                </span>
              </div>

              <div className={styles.editList}>
                {rows.length === 0 && (
                  <p className={styles.readonlyEmpty}>
                    {t('admin.rubric.noCriteria', 'No criteria defined')}
                  </p>
                )}
                {rows.map((r, i) => {
                  const rowErr = errors.rows[r._id];
                  return (
                    <div key={r._id} className={styles.criterionCard}>
                      {/* Row header */}
                      <div className={styles.cardHeader}>
                        <span className={styles.orderBadge}>{i + 1}</span>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteRow(r._id)}
                          title={t('admin.rubric.deleteTooltip', 'Remove this criterion')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Code */}
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>
                          {t('admin.rubric.label.code', 'Code')}
                          <span className={styles.required}>*</span>
                        </label>
                        <input
                          className={`${styles.input} ${rowErr?.code ? styles.inputError : ''}`}
                          type="text"
                          value={r.code}
                          onChange={(e) =>
                            handleFieldChange(r._id, 'code', e.target.value.toUpperCase())
                          }
                          placeholder="CRITERION_CODE"
                          autoCapitalize="characters"
                        />
                        {r._codeChanged && (
                          <div className={styles.warnBanner}>
                            <AlertTriangle size={12} />
                            {t('admin.rubric.warn.codeChange', 'Changing the code may break existing evaluations.')}
                          </div>
                        )}
                        {rowErr?.code && <span className={styles.fieldError}>{rowErr.code}</span>}
                      </div>

                      {/* Title */}
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>
                          {t('admin.rubric.label.title', 'Title')}
                          <span className={styles.required}>*</span>
                        </label>
                        <input
                          className={`${styles.input} ${rowErr?.title ? styles.inputError : ''}`}
                          type="text"
                          value={r.title}
                          onChange={(e) => handleFieldChange(r._id, 'title', e.target.value)}
                        />
                        {rowErr?.title && <span className={styles.fieldError}>{rowErr.title}</span>}
                      </div>

                      {/* Description */}
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>
                          {t('admin.rubric.label.description', 'Description')}
                        </label>
                        <textarea
                          className={dialogStyles.textarea}
                          rows={3}
                          value={r.description}
                          onChange={(e) => handleFieldChange(r._id, 'description', e.target.value)}
                        />
                      </div>

                      {/* MaxScore */}
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>
                          {t('admin.rubric.label.maxScore', 'Max Score')}
                          <span className={styles.required}>*</span>
                        </label>
                        <input
                          className={`${styles.inputSm} ${rowErr?.maxScore ? styles.inputError : ''}`}
                          type="number"
                          min={1}
                          step={1}
                          value={r.maxScore}
                          onChange={(e) =>
                            handleFieldChange(r._id, 'maxScore', parseInt(e.target.value, 10) || 0)
                          }
                        />
                        {rowErr?.maxScore && <span className={styles.fieldError}>{rowErr.maxScore}</span>}
                      </div>

                      {/* Standard References */}
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>
                          {t('admin.rubric.label.refs', 'Standard References')}
                        </label>
                        {r.standardReferences.length > 0 && (
                          <div className={styles.refPills}>
                            {r.standardReferences.map((ref) => (
                              <span key={ref} className={`${styles.refPill} ${styles.refPillEditable}`}>
                                {ref}
                                <button
                                  type="button"
                                  className={styles.refRemoveBtn}
                                  onClick={() => handleRemoveRef(r._id, ref)}
                                  aria-label={`Remove ${ref}`}
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <input
                          className={styles.input}
                          type="text"
                          placeholder={t('admin.rubric.refsPlaceholder', 'Type reference and press Enter')}
                          value={refInputs[r._id] ?? ''}
                          onChange={(e) =>
                            setRefInputs((prev) => ({ ...prev, [r._id]: e.target.value }))
                          }
                          onKeyDown={(e) => handleRefKeyDown(r._id, e)}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className={styles.editActionsBar}>
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={handleAddRow}
                  >
                    <Plus size={14} />
                    {t('admin.rubric.addCriterion', 'Add criterion')}
                  </button>
                  <button
                    type="button"
                    className={styles.templateBtn}
                    onClick={handleApplySystemTemplate}
                    title={t(
                      'admin.rubric.applyTemplate',
                      'Load System Template',
                    )}
                  >
                    <Sparkles size={14} />
                    {t('admin.rubric.applyTemplate', 'Load System Template')}
                  </button>
                </div>
              </div>
            </>
          )}
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
          {mode === 'custom' && (
            <button
              type="button"
              className={`${dialogStyles.button} ${dialogStyles.primaryButton}`}
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving
                ? t('admin.rubric.saving', 'Saving\u2026')
                : t('admin.rubric.save', 'Save GradingRubric')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GradingRubricModal;

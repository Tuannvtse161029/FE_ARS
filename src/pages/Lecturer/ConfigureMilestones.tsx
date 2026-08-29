import { useEffect, useMemo, useState } from 'react';
import {
  Circle,
  Upload,
  FileText,
  X,
  AlertTriangle,
  Check,
  Info,
  Loader,
  Save,
} from 'lucide-react';
import { useFirebaseUpload } from '../../hooks/useFirebaseUpload';
import styles from './ConfigureMilestones.module.css';

interface MilestonePhaseOption {
  value: string;
  label: string;
}

// The phase catalogue is FE-side — these are the canonical phase labels
// suggested in the contract. The BE does not store these yet (no /api/Milestone
// endpoint), so they live here as a UX scaffold only.
const PHASE_OPTIONS: MilestonePhaseOption[] = [
  { value: 'PHASE_1', label: 'Phase 1: Project Introduction Draft' },
  { value: 'PHASE_2', label: 'Phase 2: Literature Review Submission' },
  { value: 'PHASE_3', label: 'Phase 3: Methodology & Implementation Details' },
  { value: 'PHASE_4', label: 'Phase 4: Final Evaluation Report' },
];

// Default folder for milestone reference materials. The lecturer can override
// at upload time; the BE never persists this anyway.
const MILESTONE_MATERIALS_FOLDER = 'milestones/reference-materials/';

interface UploadedMaterialMeta {
  fileName: string;
  url: string;
}

const formatUtcDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('.')[0]?.replace('T', ' ') ?? '';
};

export const ConfigureMilestones = () => {
  const [phase, setPhase] = useState<string>(PHASE_OPTIONS[0]?.value ?? '');
  const [description, setDescription] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [materials, setMaterials] = useState<UploadedMaterialMeta[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Firebase upload — file-only, no auto-submit to BE.
  const {
    uploadPdf,
    progress,
    isUploading,
    error: uploadError,
    pdfUrl,
    resetUpload,
  } = useFirebaseUpload(MILESTONE_MATERIALS_FOLDER);

  const handleAttachPdf = async (file: File) => {
    setValidationError(null);
    await uploadPdf(file);
  };

  // When Firebase returns a URL, capture it as an attached material.
  // The URL is held in component state only — we never POST to /api/Milestone
  // because the endpoint doesn't exist yet (gap ticket §C.3).
  useEffect(() => {
    if (pdfUrl && !materials.find((m) => m.url === pdfUrl)) {
      const lastFileName = decodeURIComponent(pdfUrl.split('/').pop() ?? 'material.pdf');
      setMaterials((prev) => [...prev, { fileName: lastFileName, url: pdfUrl }]);
      resetUpload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  const handleRemoveMaterial = (idx: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = (): string | null => {
    if (!phase.trim()) return 'Please select a milestone phase.';
    if (!description.trim()) return 'Please enter milestone requirements.';
    if (!dueDate) return 'Please pick a hard due date.';
    const dueMs = new Date(dueDate).getTime();
    if (Number.isNaN(dueMs)) return 'Due date is not a valid timestamp.';
    if (dueMs <= Date.now()) return 'Due date must be in the future.';
    if (openDate) {
      const openMs = new Date(openDate).getTime();
      if (Number.isNaN(openMs)) return 'Open date is not a valid timestamp.';
      if (openMs >= dueMs) return 'Open date must be earlier than due date.';
    }
    return null;
  };

  const daysRemainingLabel = useMemo(() => {
    if (!dueDate) return null;
    const dueMs = new Date(dueDate).getTime();
    if (Number.isNaN(dueMs)) return null;
    const diffMs = dueMs - Date.now();
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (days < 0) return 'Past due';
    if (days === 0) return 'Due today';
    if (days === 1) return '1 day remaining';
    return `${days} days remaining`;
  }, [dueDate]);

  // The Publish button is intentionally disabled — the BE endpoint
  // `POST /api/Milestone` is missing (gap ticket §C.3). We still validate the
  // form so the lecturer gets immediate feedback on what the eventual submit
  // payload will need to look like. No fake save — no fake success banner.
  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    setValidationError(err);
    // The button is always disabled, but Enter-key on form submission still
    // reaches here. Surface the validation result via the same banner pattern
    // — when validation passes, we set a soft hint instead of faking a save.
    if (!err) {
      setValidationError(null);
    }
  };

  const isPublishDisabled = true;

  return (
    <div className={styles.configureMilestones}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Guidance Group &gt; <span className={styles.activeBreadcrumb}>Configure Milestones</span>
      </div>

      {/* Page header and card */}
      <div className={styles.configCard}>
        <div className={styles.cardHeader}>
          <div className={styles.headerTitleRow}>
            <span className={styles.headerLabel}>MILESTONE CONFIGURATION</span>
            <h1 className={styles.pageTitle}>CONFIGURE MILESTONE TARGETS</h1>
          </div>
          <span className={styles.draftBadge}>
            <Circle size={8} fill="currentColor" aria-hidden />
            DRAFT (PREVIEW)
          </span>
        </div>

        {/* BE gap banner — required so the user knows why Save is disabled. */}
        <div className={styles.gapBanner} role="status">
          <Info size={14} aria-hidden />
          <span>
            <b>Save disabled — BE endpoint pending.</b> The{' '}
            <code>POST /api/Milestone</code> endpoint is not yet exposed by the BE
            (see{' '}
            <i>docs/local-only/api-gap-ticket-for-be.md</i> §C.3). Until BE ships
            the resource, the form validates but does not persist. Reference
            materials uploaded here are kept in Firebase Storage only.
          </span>
        </div>

        <form onSubmit={handlePublish} className={styles.form} noValidate>
          {/* Milestone Track Phase */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="phase">
              * Milestone Track Phase
            </label>
            <select
              id="phase"
              className={styles.formSelect}
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
            >
              {PHASE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className={styles.helperText}>
              Select the research phase this milestone belongs to within the active
              automation network.
            </span>
          </div>

          {/* Description */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="description">
              * Description Requirements &amp; Guidelines
            </label>
            <textarea
              id="description"
              className={styles.formTextarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              maxLength={8000}
            />
            <div className={styles.textMeta}>
              <span className={styles.helperText}>
                Provide detailed submission requirements, evaluation criteria, and
                formatting standards.
              </span>
              <span className={styles.charCounter}>
                {description.length} / 8,000
              </span>
            </div>
          </div>

          {/* Dates */}
          <div className={styles.rowFormGroup}>
            <div className={styles.formCol}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="openDate">
                  Open Date (optional)
                </label>
                <input
                  id="openDate"
                  type="datetime-local"
                  className={styles.formInput}
                  value={openDate}
                  onChange={(e) => setOpenDate(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.formCol}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="dueDate">
                  * Hard Due Date &amp; Timeline Boundary
                </label>
                <input
                  id="dueDate"
                  type="datetime-local"
                  className={styles.formInput}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <span className={styles.helperText}>
                  UTC. Submissions received after this boundary will be flagged as
                  non-compliant.
                </span>
              </div>
            </div>

            {daysRemainingLabel && (
              <div className={styles.remainingBox}>
                <Circle
                  size={8}
                  fill="currentColor"
                  className={styles.remainingDot}
                  aria-hidden
                />
                <div className={styles.remainingTexts}>
                  <span className={styles.remainingTitle}>{daysRemainingLabel}</span>
                  <span className={styles.remainingSub}>
                    Deadline · {formatUtcDate(dueDate)} UTC
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Reference Materials */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Reference Materials</label>
            <div className={styles.uploadZone}>
              <Upload size={28} className={styles.uploadIcon} aria-hidden />
              <p className={styles.uploadTitle}>
                Upload reference PDFs or template DOCX documents.
              </p>
              <p className={styles.uploadSub}>
                PDF only · up to 10 MB · uploaded to Firebase Storage
              </p>
              <label className={styles.browseLabel}>
                <input
                  type="file"
                  accept="application/pdf"
                  className={styles.hiddenFileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAttachPdf(file);
                    e.target.value = '';
                  }}
                />
                <Upload size={14} aria-hidden />
                {isUploading ? `Uploading… ${progress}%` : 'Browse files'}
              </label>
            </div>

            {uploadError && (
              <div className={styles.errorBanner} role="alert">
                <AlertTriangle size={14} aria-hidden />
                <span>{uploadError}</span>
              </div>
            )}

            {materials.length > 0 && (
              <div className={styles.filesList}>
                {materials.map((m, idx) => (
                  <div key={`${m.url}-${idx}`} className={styles.fileRow}>
                    <FileText size={16} className={styles.fileIcon} aria-hidden />
                    <span className={styles.fileName}>{m.fileName}</span>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.fileLinkBtn}
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      className={styles.removeFileBtn}
                      onClick={() => handleRemoveMaterial(idx)}
                      aria-label={`Remove ${m.fileName}`}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <span className={styles.helperText}>
              Uploaded materials will be distributed to participants upon milestone
              activation (once BE ships /api/Milestone).
            </span>
          </div>

          {/* Validation error */}
          {validationError && (
            <div className={styles.errorBanner} role="alert">
              <AlertTriangle size={14} aria-hidden />
              <span>{validationError}</span>
            </div>
          )}

          {/* Save button — explicitly disabled with tooltip. */}
          <div className={styles.publishRow}>
            <button
              type="submit"
              className={styles.publishBtn}
              disabled={isPublishDisabled || isUploading}
              title="Save disabled — BE endpoint pending"
              aria-disabled="true"
            >
              {isUploading ? (
                <Loader size={14} className={styles.spinningIcon} aria-hidden />
              ) : (
                <Save size={14} aria-hidden />
              )}
              PUBLISH MILESTONE REQUIREMENTS
            </button>
            <span className={styles.publishTooltip}>
              <AlertTriangle size={12} aria-hidden />
              Save disabled — BE endpoint pending
            </span>
          </div>

          <p className={styles.publishDisclaimer}>
            Until the BE exposes <code>POST /api/Milestone</code>, this form is a
            validation-only preview. Required payload shape (per
            api-gap-ticket-for-be.md §C.3): <code>phase</code>,{' '}
            <code>description</code>, <code>dueDate</code>,{' '}
            <code>referenceMaterials[]</code>.
          </p>

          {/* Inline visual acknowledgement that validation passed but save is
              still disabled — keeps the lecturer informed without faking a
              success flow. */}
          {!validationError && description && phase && dueDate && (
            <div className={styles.successHint}>
              <Check size={14} aria-hidden />
              <span>Configuration is valid. Save is disabled pending BE endpoint.</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ConfigureMilestones;
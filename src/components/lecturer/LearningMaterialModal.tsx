// LearningMaterialModal — opened from the Lecturer "Manage Materials" affordance
// on the Research Topic row. Lists the materials the current lecturer has
// attached to a topic. The BE has no `LearningMaterial.topicId` column, so
// per-contract §3.1 / L3.c the modal reads via `useLearningMaterials` (which
// already filters by `lecturerId`) — there is no fake persistence; adding a
// new material requires the same `learningMaterialService.create` call that
// ConfigureMilestones uses once BE ships a real topic-id column.
//
// This component is modal-only (per contract §15.1 — pages must split out
// modals) and renders nothing when `isOpen === false`.

import { useEffect, useState, type FormEvent } from 'react';
import {
  X,
  FileText,
  Plus,
  Loader,
  AlertTriangle,
  ExternalLink,
  Check,
  Library,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import { learningMaterialService } from '../../services/learningMaterial.service';
import type { LearningMaterial } from '../../services/learningMaterial.service';
import type { ResearchTopic } from '../../services/researchTopic.service';
import {
  MaterialSourcePicker,
  type MaterialSourceValue,
} from './MaterialSourcePicker';
import styles from './LearningMaterialModal.module.css';

export interface LearningMaterialModalProps {
  isOpen: boolean;
  topic: ResearchTopic | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface BannerState {
  visible: boolean;
  text: string;
  variant: 'success' | 'error';
}

const formatTitle = (m: LearningMaterial): string => {
  if (m.title && m.title.trim().length > 0) return m.title.trim();
  if (m.id) return `Material #${m.id}`;
  return 'Untitled material';
};

export const LearningMaterialModal = ({
  isOpen,
  topic,
  onClose,
  onSuccess,
}: LearningMaterialModalProps) => {
  const { user } = useAuth();
  const lecturerId = user?.userId ?? null;
  const {
    materials,
    isLoading,
    error,
    refetch,
  } = useLearningMaterials({ lecturerId });

  const [newTitle, setNewTitle] = useState('');
  const [newSource, setNewSource] = useState<MaterialSourceValue | null>(null);
  const [newSubFieldId, setNewSubFieldId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    text: '',
    variant: 'success',
  });

  useEffect(() => {
    if (!isOpen) {
      setNewTitle('');
      setNewSource(null);
      setNewSubFieldId('');
      setFormError(null);
      setPickerError(null);
      setBanner({ visible: false, text: '', variant: 'success' });
    }
  }, [isOpen]);

  if (!isOpen || !topic) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!lecturerId) {
      setFormError('No lecturer session — please sign in again.');
      return;
    }
    const title = newTitle.trim();
    if (!title) {
      setFormError('Title is required.');
      return;
    }
    // The picker emits a single value whose kind determines how we
    // resolve the fileUrl we POST to the BE. URL + File kinds both
    // produce a direct URL; the Library kind is a no-op for this
    // modal because we're already creating a new material — we still
    // require the user to attach a concrete file/URL.
    let resolvedUrl: string | null = null;
    if (newSource) {
      if (newSource.kind === 'url') {
        resolvedUrl = newSource.url.trim();
      } else if (newSource.kind === 'file') {
        resolvedUrl = newSource.fileUrl;
      } else {
        setPickerError(
          'Pick a Link or Upload source for a new material. To reuse an existing one, close this modal and select it from your library.',
        );
        return;
      }
    }
    if (!resolvedUrl) {
      setPickerError(
        'File URL is required. Paste a URL or upload a file before adding.',
      );
      return;
    }
    setPickerError(null);
    const subFieldIdNum = newSubFieldId.trim().length
      ? Number(newSubFieldId.trim())
      : undefined;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await learningMaterialService.create({
        lecturerId,
        title,
        fileUrl: resolvedUrl,
        description: null,
        subFieldId:
          typeof subFieldIdNum === 'number' && Number.isFinite(subFieldIdNum)
            ? subFieldIdNum
            : null,
      });
      // We do NOT pass `topicId` because the BE has no column for it yet
      // (gap ticket §C.1.1 / §E.11). The "topic-attached" semantics live
      // client-side only — the modal lists every material the lecturer
      // owns. The header note documents the limit.
      setNewTitle('');
      setNewSource(null);
      setNewSubFieldId('');
      setBanner({
        visible: true,
        text: 'Material added to your library. Topic-scoped grouping ships once BE adds a topicId column.',
        variant: 'success',
      });
      await refetch();
      onSuccess?.();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'The server rejected the material. Please try again.';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!id) return;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm('Delete this material? This cannot be undone.');
      if (!ok) return;
    }
    try {
      await learningMaterialService.delete(id);
      setBanner({
        visible: true,
        text: 'Material deleted.',
        variant: 'success',
      });
      await refetch();
      onSuccess?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete the material.';
      setBanner({ visible: true, text: message, variant: 'error' });
    }
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <div className={styles.modalHeaderRow}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.modalIconCircle}>
              <Library size={18} aria-hidden />
            </span>
            <div>
              <h3 className={styles.modalTitle}>Topic Learning Materials</h3>
              <span className={styles.modalSubtitle}>
                {topic.title ?? `(Topic #${topic.id ?? '—'})`}
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close materials modal"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.gapNote} role="note">
          <AlertTriangle size={14} aria-hidden />
          <span>
            The backend has no{' '}
            <code>LearningMaterial.topicId</code> column, so this modal lists
            every material you (this lecturer) own. Topic-scoped filtering
            ships once BE adds a{' '}
            <code>topicId</code> column per gap ticket §E.11.
          </span>
        </div>

        {banner.visible && (
          <div
            className={`${styles.banner} ${
              banner.variant === 'success' ? styles.bannerSuccess : styles.bannerError
            }`}
            role="status"
          >
            <span className={styles.bannerIcon}>
              {banner.variant === 'success' ? (
                <Check size={14} strokeWidth={3} aria-hidden />
              ) : (
                <AlertTriangle size={14} aria-hidden />
              )}
            </span>
            <span className={styles.bannerText}>{banner.text}</span>
            <button
              type="button"
              className={styles.bannerCloseBtn}
              onClick={() =>
                setBanner({ visible: false, text: '', variant: 'success' })
              }
              aria-label="Dismiss"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        )}

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span>{error.message}</span>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </div>
        )}

        <div className={styles.listBox}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <Loader size={16} className={styles.spinningIcon} aria-hidden />
              Loading your materials…
            </div>
          ) : materials.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText size={20} aria-hidden />
              <span>You have no learning materials yet. Use the form below to add one.</span>
            </div>
          ) : (
            <ul className={styles.list}>
              {materials.map((m) => {
                const id = typeof m.id === 'number' ? m.id : -1;
                return (
                  <li key={String(m.id)} className={styles.listItem}>
                    <div className={styles.itemMeta}>
                      <span className={styles.itemTitle}>{formatTitle(m)}</span>
                      {m.description?.trim() && (
                        <span className={styles.itemDescription}>
                          {m.description}
                        </span>
                      )}
                      {m.subFieldId != null && (
                        <span className={styles.itemSubField}>
                          Sub-field #{m.subFieldId}
                        </span>
                      )}
                    </div>
                    <div className={styles.itemActions}>
                      {m.fileUrl && (
                        <a
                          className={styles.openLink}
                          href={m.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${formatTitle(m)} in a new tab`}
                        >
                          <ExternalLink size={14} aria-hidden />
                          Open
                        </a>
                      )}
                      {id >= 0 && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => void handleDelete(id)}
                          aria-label={`Delete ${formatTitle(m)}`}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form onSubmit={handleAdd} className={styles.form}>
          <span className={styles.formTitle}>
            <Plus size={14} aria-hidden /> Add a new learning material
          </span>
          <div className={styles.formRow}>
            <label className={styles.formLabel} htmlFor="mat-title">
              * Title
            </label>
            <input
              id="mat-title"
              type="text"
              className={styles.formInput}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Reference syllabus — Week 1"
              required
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              * File URL
            </label>
            <MaterialSourcePicker
              value={newSource}
              onChange={(v) => {
                setNewSource(v);
                if (pickerError) setPickerError(null);
              }}
              errorMessage={pickerError}
              inputId="lmMaterialSourceUrl"
            />
            <span className={styles.helperText}>
              Link to an existing URL, upload a new PDF, or pick from your
              library — the file URL is what students will open.
            </span>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel} htmlFor="mat-subfield">
              Sub-field ID (optional)
            </label>
            <input
              id="mat-subfield"
              type="number"
              className={styles.formInput}
              value={newSubFieldId}
              onChange={(e) => setNewSubFieldId(e.target.value)}
              placeholder="42"
            />
          </div>

          {formError && (
            <div className={styles.formErrorBanner} role="alert">
              <AlertTriangle size={14} aria-hidden />
              <span>{formError}</span>
            </div>
          )}

          <div className={styles.formFooter}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Close
            </button>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader size={14} className={styles.spinningIcon} aria-hidden />
              ) : (
                <Plus size={14} aria-hidden />
              )}
              {isSubmitting ? 'Adding…' : 'Add Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LearningMaterialModal;

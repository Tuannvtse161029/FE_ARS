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

import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
import { topicLearningMaterialService } from '../../services/researchTopic.service';
import type { TopicLearningMaterialResponse } from '../../types/researchWorkflowDtos';
import type { ResearchTopic } from '../../services/researchTopic.service';
import { safeHref } from '../../utils/validationRules';
import {
  MaterialSourcePicker,
  type MaterialSourceValue,
} from './MaterialSourcePicker';
import { ConfirmModal } from './ConfirmModal';
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

const formatTitle = (m: TopicLearningMaterialResponse): string => {
  if (m.title && m.title.trim().length > 0) return m.title.trim();
  if (m.learningMaterialId) return `Material #${m.learningMaterialId}`;
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
  const topicId = topic?.id ?? topic?.topicId ?? null;

  const [materials, setMaterials] = useState<TopicLearningMaterialResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newSource, setNewSource] = useState<MaterialSourceValue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    text: '',
    variant: 'success',
  });

  /** Controls the detach-confirmation modal */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    materialId: number | null;
    materialTitle: string;
  }>({ open: false, materialId: null, materialTitle: '' });

  const fetchTopicMaterials = useCallback(async () => {
    if (!topicId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await topicLearningMaterialService.getByTopicId(topicId);
      setMaterials(data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load topic materials.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    if (isOpen && topicId) {
      void fetchTopicMaterials();
    }
  }, [isOpen, topicId, fetchTopicMaterials]);

  useEffect(() => {
    if (!isOpen) {
      setNewTitle('');
      setNewSource(null);
      setFormError(null);
      setPickerError(null);
      setBanner({ visible: false, text: '', variant: 'success' });
    }
  }, [isOpen]);

  if (!isOpen || !topic || !topicId) return null;

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

    setPickerError(null);
    setFormError(null);

    // If source is library, attach existing material
    if (newSource?.kind === 'library') {
      setIsSubmitting(true);
      try {
        await topicLearningMaterialService.attach(
          topicId,
          newSource.learningMaterialId,
        );
        setNewTitle('');
        setNewSource(null);
        setBanner({
          visible: true,
          text: 'Material attached to topic successfully.',
          variant: 'success',
        });
        await fetchTopicMaterials();
        onSuccess?.();
      } catch (err: unknown) {
        const errorObj = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
        const status = errorObj.response?.status;
        let message = errorObj.response?.data?.message || errorObj.message || 'Failed to attach material.';
        if (status === 409) {
          message = 'This material is already attached to this research topic.';
        } else if (status === 403) {
          message = 'You are not authorized to manage materials for this topic.';
        }
        setFormError(message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Otherwise, require title and URL/file
    const title = newTitle.trim();
    if (!title) {
      setFormError('Title is required for a new material.');
      return;
    }

    let resolvedUrl: string | null = null;
    if (newSource) {
      if (newSource.kind === 'url') {
        resolvedUrl = newSource.url.trim();
      } else if (newSource.kind === 'file') {
        resolvedUrl = newSource.fileUrl;
      }
    }

    if (!resolvedUrl) {
      setPickerError(
        'File URL is required. Paste a URL, upload a file, or pick from your library before adding.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await topicLearningMaterialService.createAndAttach(topicId, {
        lecturerId,
        title,
        fileUrl: resolvedUrl,
        description: null,
      });
      setNewTitle('');
      setNewSource(null);
      setBanner({
        visible: true,
        text: 'Material created and attached to topic successfully.',
        variant: 'success',
      });
      await fetchTopicMaterials();
      onSuccess?.();
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = errorObj.response?.status;
      let message = errorObj.response?.data?.message || errorObj.message || 'Failed to create and attach material.';
      if (status === 409) {
        message = 'This material is already attached to this research topic.';
      } else if (status === 403) {
        message = 'You are not authorized to manage materials for this topic.';
      } else if (status === 400) {
        message = errorObj.response?.data?.message || 'Invalid material data. Please check the URL and format.';
      }
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetach = (id: number, title: string) => {
    if (!id) return;
    setDeleteConfirm({ open: true, materialId: id, materialTitle: title });
  };

  const confirmDetach = async () => {
    const id = deleteConfirm.materialId;
    if (!id) return;
    setDeleteConfirm({ open: false, materialId: null, materialTitle: '' });
    try {
      await topicLearningMaterialService.detach(topicId, id);
      setBanner({
        visible: true,
        text: 'Material removed from this topic.',
        variant: 'success',
      });
      await fetchTopicMaterials();
      onSuccess?.();
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = errorObj.response?.status;
      let message = errorObj.response?.data?.message || errorObj.message || 'Failed to detach the material.';
      if (status === 403) {
        message = 'You are not authorized to remove materials from this topic.';
      }
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
              onClick={() => void fetchTopicMaterials()}
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
                const id = typeof m.learningMaterialId === 'number' ? m.learningMaterialId : -1;
                return (
                  <li key={String(m.learningMaterialId)} className={styles.listItem}>
                    <div className={styles.itemMeta}>
                      <span className={styles.itemTitle}>{formatTitle(m)}</span>
                      {m.description?.trim() && (
                        <span className={styles.itemDescription}>
                          {m.description}
                        </span>
                      )}
                    </div>
                    <div className={styles.itemActions}>
                      {m.fileUrl && safeHref(m.fileUrl) && (
                        <a
                          className={styles.openLink}
                          href={safeHref(m.fileUrl) ?? '#'}
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
                          onClick={() => handleDetach(id, formatTitle(m))}
                          aria-label={`Detach ${formatTitle(m)} from topic`}
                        >
                          Detach
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
              {newSource?.kind === 'library' ? 'Title (Optional for library)' : '* Title'}
            </label>
            <input
              id="mat-title"
              type="text"
              className={styles.formInput}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={
                newSource?.kind === 'library'
                  ? 'Keep existing title or enter override'
                  : 'Reference syllabus — Week 1'
              }
              required={newSource?.kind !== 'library'}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel} htmlFor="lmMaterialSourceUrl">
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
              {isSubmitting
                ? 'Adding…'
                : newSource?.kind === 'library'
                ? 'Attach Material'
                : 'Add Material'}
            </button>
          </div>
        </form>
      </div>

      {/* Detach confirmation modal */}
      <ConfirmModal
        open={deleteConfirm.open}
        title="Detach Material?"
        description={`Detach "${deleteConfirm.materialTitle}" from this research topic? The original material in your library will remain intact.`}
        variant="destructive"
        confirmLabel="Detach"
        cancelLabel="Cancel"
        onConfirm={confirmDetach}
        onClose={() =>
          setDeleteConfirm({ open: false, materialId: null, materialTitle: '' })
        }
      />
    </div>
  );
};

export default LearningMaterialModal;

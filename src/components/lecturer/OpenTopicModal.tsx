// OpenTopicModal — reusable modal that surfaces a topic's title,
// description, and attached material(s) when a student or other
// consumer opens a topic from a linked surface (e.g. the Group Detail
// page's "Open Topic" affordance).
//
// Designed to be called from GroupDetail and any other surface that
// wants to deep-show a topic without forcing a full-page navigation.
// Consumers pass an `isOpen` flag, the topic to render, and a close
// callback. The modal renders nothing when `isOpen === false`.
//
// The "materials" rendering covers both shapes the topic can take:
//   - { kind: 'url', url }          → HTTPS link (rendered as an "Open" button)
//   - { kind: 'file', fileUrl, … }  → Firebase file (rendered as a filename + link)
//   - { kind: 'library', id }       → Existing LearningMaterial (looked up + shown)

import { useEffect, useMemo } from 'react';
import {
  X,
  Lightbulb,
  ExternalLink,
  Link2,
  FileText,
  Library,
  Loader,
  AlertTriangle,
} from 'lucide-react';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import type { LearningMaterial } from '../../services/learningMaterial.service';
import styles from './OpenTopicModal.module.css';

export interface OpenTopicMaterial {
  kind: 'url' | 'file' | 'library';
  /** For 'url' / 'file' kinds. */
  url?: string | null;
  /** For 'file' / 'library' kinds. */
  fileName?: string | null;
  /** For 'library' kind. */
  learningMaterialId?: number | null;
}

export interface OpenTopicPayload {
  title: string;
  description?: string | null;
  material?: OpenTopicMaterial | null;
}

export interface OpenTopicModalProps {
  isOpen: boolean;
  topic: OpenTopicPayload | null;
  /** When the library kind is used, we look up the material to render its real title. */
  currentLecturerId?: number | null;
  onClose: () => void;
}

const formatMaterialTitle = (m: LearningMaterial): string => {
  if (m.title && m.title.trim().length > 0) return m.title.trim();
  if (m.id) return `Material #${m.id}`;
  return 'Library material';
};

export const OpenTopicModal = ({
  isOpen,
  topic,
  currentLecturerId,
  onClose,
}: OpenTopicModalProps) => {
  const shouldFetchLibrary =
    isOpen && topic?.material?.kind === 'library' && topic?.material?.learningMaterialId;

  const {
    materials,
    isLoading: libraryLoading,
    error: libraryError,
  } = useLearningMaterials({ lecturerId: currentLecturerId });

  const libraryMaterial: LearningMaterial | null = useMemo(() => {
    if (!shouldFetchLibrary || !topic?.material) return null;
    const targetId = topic.material.learningMaterialId;
    if (typeof targetId !== 'number') return null;
    return (
      materials.find((m) => m.id === targetId) ?? {
        id: targetId,
        title: `Material #${targetId}`,
      }
    );
  }, [materials, shouldFetchLibrary, topic]);

  // ESC closes the modal.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !topic) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-topic-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.card} data-testid="open-topic-modal">
        <div className={styles.headerRow}>
          <div className={styles.titleBlock}>
            <span className={styles.iconCircle}>
              <Lightbulb size={18} aria-hidden />
            </span>
            <div>
              <h3 className={styles.title} id="open-topic-title">
                {topic.title}
              </h3>
              <span className={styles.subtitle}>Research topic details</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Description */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <h4 className={styles.sectionTitle}>Description</h4>
          </header>
          {topic.description?.trim() ? (
            <p className={styles.description}>{topic.description}</p>
          ) : (
            <p className={styles.emptyDescription}>
              No description has been written for this topic yet.
            </p>
          )}
        </section>

        {/* Materials */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <h4 className={styles.sectionTitle}>
              <Library size={14} aria-hidden /> Reference Materials
            </h4>
          </header>
          {!topic.material ? (
            <p className={styles.emptyDescription}>
              No reference material has been attached to this topic.
            </p>
          ) : topic.material.kind === 'url' ? (
            <a
              className={styles.materialRow}
              href={topic.material.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.materialIcon}>
                <Link2 size={16} aria-hidden />
              </span>
              <div className={styles.materialBody}>
                <span className={styles.materialTitle}>External link</span>
                <span className={styles.materialSub}>{topic.material.url}</span>
              </div>
              <span className={styles.materialOpenBtn}>
                <ExternalLink size={14} aria-hidden /> Open
              </span>
            </a>
          ) : topic.material.kind === 'file' ? (
            <a
              className={styles.materialRow}
              href={topic.material.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.materialIcon}>
                <FileText size={16} aria-hidden />
              </span>
              <div className={styles.materialBody}>
                <span className={styles.materialTitle}>
                  {topic.material.fileName?.trim() || 'Attached file'}
                </span>
                {topic.material.url && (
                  <span className={styles.materialSub}>{topic.material.url}</span>
                )}
              </div>
              <span className={styles.materialOpenBtn}>
                <ExternalLink size={14} aria-hidden /> Open
              </span>
            </a>
          ) : (
            // library kind
            shouldFetchLibrary && libraryLoading ? (
              <div className={styles.loadingRow}>
                <Loader size={14} className={styles.spinningIcon} aria-hidden />
                Loading material…
              </div>
            ) : libraryError ? (
              <div className={styles.errorRow} role="alert">
                <AlertTriangle size={14} aria-hidden />
                <span>{libraryError.message}</span>
              </div>
            ) : libraryMaterial && libraryMaterial.fileUrl ? (
              <a
                className={styles.materialRow}
                href={libraryMaterial.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.materialIcon}>
                  <FileText size={16} aria-hidden />
                </span>
                <div className={styles.materialBody}>
                  <span className={styles.materialTitle}>
                    {formatMaterialTitle(libraryMaterial)}
                  </span>
                  {libraryMaterial.description?.trim() && (
                    <span className={styles.materialSub}>
                      {libraryMaterial.description}
                    </span>
                  )}
                </div>
                <span className={styles.materialOpenBtn}>
                  <ExternalLink size={14} aria-hidden /> Open
                </span>
              </a>
            ) : (
              <p className={styles.emptyDescription}>
                The selected library material could not be found.
              </p>
            )
          )}
        </section>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.closeFooterBtn}
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default OpenTopicModal;
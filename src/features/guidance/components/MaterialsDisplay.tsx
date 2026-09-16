/**


 * MaterialsDisplay — learning materials list


 *


   10| * Extracted from src/pages/Lecturer/GroupDetail.tsx


 *


 * Displays two distinct material buckets for a research group:

 *   1. **Topic-attached materials** (`topicMaterials`) — what the

 *      lecturer explicitly attached via the "Manage Materials" affordance

 *      on the Research Topic page. These come from

 *      `/api/ResearchTopic/{topicId}/learning-materials` and surface here

 *      via `useTopicLearningMaterials`. This is the FIX for the bug where

 *      materials attached to the Research Topic did NOT appear in either

 *      the lecturer's group detail page or the graduate student's

 *      workspace.

 *   2. **Lecturer library** (`materials`) — the lecturer's global

 *      LearningMaterial library filtered by lecturerId. Kept here so the

 *      lecturer can see all of their materials in one place while

 *      configuring phases.

 * When a group has no topic (`topicId === null`), the topic section is

 * hidden entirely and the page degrades to the library-only view.


 */

import { Loader, AlertTriangle, ExternalLink, Library, FileText } from 'lucide-react';

import { useI18n } from '../../../i18n/I18nContext';
import type { LearningMaterial } from '../../../services/learningMaterial.service';
import { safeHref } from '../../../utils/validationRules';

// CSS module kept at the original GroupDetail CSS location for now.
import styles from '../../../pages/Lecturer/GroupDetail.module.css';

export interface MaterialsDisplayProps {
  /** Lecturer's global library (filtered by lecturerId upstream). */
  materials: LearningMaterial[];

  /** Materials explicitly attached to the group's Research Topic.
   *  Empty when the group has no topic — falls back to library only. */
  topicMaterials?: LearningMaterial[];

  isLoading: boolean;

  /** Separate loading flag for the topic-level endpoint. */
  isTopicLoading?: boolean;

  error: { message: string } | null;

  /** Separate error from the topic-level endpoint. */
  topicError?: { message: string } | null;

  onRetry: () => void;

  onRetryTopic?: () => void;
}

export const MaterialsDisplay = ({
  materials,
  topicMaterials = [],
  isLoading,
  isTopicLoading = false,
  error,
  topicError,
  onRetry,
  onRetryTopic,
}: MaterialsDisplayProps) => {
  const { t } = useI18n();

  // `topicError` defaults to `undefined` when callers omit it, and
  // `undefined !== null` is true — which would render the topic section
  // even when the caller intends to skip it. Guard against both.
  const hasTopicSection =
    topicMaterials.length > 0 || isTopicLoading || (topicError !== null && topicError !== undefined);
  const totalCount = materials.length + topicMaterials.length;

  const renderMaterialRow = (m: LearningMaterial, key: string) => {
    const id = typeof m.id === 'number' ? m.id : -1;
    const title = (m.title ?? '').trim() || `${t('lecturer.groupDetail.materialPrefix')}${id}`;
    return (
      <li key={key} className={styles.materialRow}>
        <div className={styles.materialMeta}>
          <span className={styles.materialTitle}>{title}</span>
          {m.description?.trim() && (
            <span className={styles.materialDesc}>{m.description}</span>
          )}
        </div>
        {m.fileUrl && safeHref(m.fileUrl) && (
          <a
            className={styles.openLink}
            href={safeHref(m.fileUrl) ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} aria-hidden />
            {t('lecturer.groupDetail.open')}
          </a>
        )}
      </li>
    );
  };

  return (
    <section className={`${styles.card} ${styles.cardFull}`}>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          <Library size={16} aria-hidden /> {t('lecturer.groupDetail.learningMaterialsTitle')}
        </h2>
        <span className={styles.cardHint}>
          {t('lecturer.groupDetail.learningMaterialsHint')}
        </span>
      </header>

      {error && (
        <div className={styles.errorPanel} role="alert">
          <AlertTriangle size={14} aria-hidden />
          <span>{error.message}</span>
          <button type="button" className={styles.retryBtn} onClick={onRetry}>
            {t('lecturer.groupDetail.retry')}
          </button>
        </div>
      )}

      {/* Topic-attached materials — the FIX for the September 2026 bug
          where topic-level attachments were dropped from the group
          detail page. See useTopicLearningMaterials.ts for the BE
          contract. */}
      {hasTopicSection && (
        <div className={styles.materialSection}>
          <h3 className={styles.materialSectionTitle}>
            <FileText size={14} aria-hidden /> {t('lecturer.groupDetail.topicMaterialsTitle', 'Materials attached to this topic')}
          </h3>
          {topicError && (
            <div className={styles.errorPanel} role="alert">
              <AlertTriangle size={14} aria-hidden />
              <span>{topicError.message}</span>
              {onRetryTopic && (
                <button type="button" className={styles.retryBtn} onClick={onRetryTopic}>
                  {t('lecturer.groupDetail.retry')}
                </button>
              )}
            </div>
          )}
          {isTopicLoading ? (
            <div className={styles.loadingPanel}>
              <Loader size={14} className={styles.spinningIcon} aria-hidden />
              {t('lecturer.groupDetail.loadingMaterials')}
            </div>
          ) : topicMaterials.length === 0 ? (
            <div className={styles.emptyState}>
              <Library size={18} aria-hidden />
              {t('lecturer.groupDetail.noTopicMaterials', 'No materials are attached to this group’s research topic yet.')}
            </div>
          ) : (
            <ul className={styles.materialList} data-testid="topic-materials-list">
              {topicMaterials.map((m) =>
                renderMaterialRow(
                  m,
                  `topic-mat-${(typeof m.id === 'number' ? m.id : 0)}-${m.fileUrl ?? ''}`,
                ),
              )}
            </ul>
          )}
        </div>
      )}

      {/* Lecturer library — kept as the second bucket so the lecturer
          can manage their full library while configuring phases. */}
      {isLoading ? (
        <div className={styles.loadingPanel}>
          <Loader size={14} className={styles.spinningIcon} aria-hidden />
          {t('lecturer.groupDetail.loadingMaterials')}
        </div>
      ) : totalCount === 0 ? (
        <div className={styles.emptyState}>
          <Library size={18} aria-hidden />
          {t('lecturer.groupDetail.noMaterials')}
        </div>
      ) : (
        <div className={styles.materialSection}>
          <h3 className={styles.materialSectionTitle}>
            <Library size={14} aria-hidden /> {t('lecturer.groupDetail.libraryMaterialsTitle', 'Lecturer library')}
          </h3>
          <ul className={styles.materialList}>
            {materials.map((m) =>
              renderMaterialRow(
                m,
                `mat-${(typeof m.id === 'number' ? m.id : 0)}-${m.fileUrl ?? ''}`,
              ),
            )}
          </ul>
        </div>
      )}
    </section>
  );
};

export default MaterialsDisplay;

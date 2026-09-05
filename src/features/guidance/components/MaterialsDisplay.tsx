/**
 * MaterialsDisplay — learning materials list
 *
 * Extracted from src/pages/Lecturer/GroupDetail.tsx
 */
import { Loader, AlertTriangle, ExternalLink, Library } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import type { LearningMaterial } from '../../../services/learningMaterial.service';
// CSS module kept at the original GroupDetail CSS location for now.
import styles from '../../pages/Lecturer/GroupDetail.module.css';

export interface MaterialsDisplayProps {
  materials: LearningMaterial[];
  isLoading: boolean;
  error: { message: string } | null;
  onRetry: () => void;
}

export const MaterialsDisplay: React.FC<MaterialsDisplayProps> = ({
  materials,
  isLoading,
  error,
  onRetry,
}) => {
  const { t } = useI18n();

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
      {isLoading ? (
        <div className={styles.loadingPanel}>
          <Loader size={14} className={styles.spinningIcon} aria-hidden />
          {t('lecturer.groupDetail.loadingMaterials')}
        </div>
      ) : materials.length === 0 ? (
        <div className={styles.emptyState}>
          <Library size={18} aria-hidden />
          {t('lecturer.groupDetail.noMaterials')}
        </div>
      ) : (
        <ul className={styles.materialList}>
          {materials.map((m) => {
            const id = typeof m.id === 'number' ? m.id : -1;
            const title = (m.title ?? '').trim() || `${t('lecturer.groupDetail.materialPrefix')}${id}`;
            return (
              <li key={`mat-${id}`} className={styles.materialRow}>
                <div className={styles.materialMeta}>
                  <span className={styles.materialTitle}>{title}</span>
                  {m.description?.trim() && (
                    <span className={styles.materialDesc}>{m.description}</span>
                  )}
                </div>
                {m.fileUrl && (
                  <a
                    className={styles.openLink}
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} aria-hidden />
                    {t('lecturer.groupDetail.open')}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default MaterialsDisplay;

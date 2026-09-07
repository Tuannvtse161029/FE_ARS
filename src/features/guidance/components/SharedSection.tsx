/**
 * SharedSection — Shared materials section component
 *
 * Extracted from src/pages/Lecturer/Materials.tsx
 */
import type { ReactNode } from 'react';
import { Loader, FileText } from 'lucide-react';
import { useT } from '../../../i18n/I18nContext';
import type { SharedMaterial } from '../../../services/sharedMaterial.service';
import { resolveUiStatus } from '../MaterialsPage';
// CSS module kept at the original Materials CSS location for now.
import styles from '../../pages/Lecturer/Materials.module.css';

export interface SharedSectionProps {
  title: string;
  emptyText: string;
  loading: boolean;
  items: SharedMaterial[];
  resolveTitle: (item: SharedMaterial) => { title: string; known: boolean };
  resolveColleagueName: (item: SharedMaterial) => string;
  resolveExpiry: (
    sharedAt: string | null | undefined,
  ) => { iso: string; daysRemaining: number | null };
  renderAction: (item: SharedMaterial) => ReactNode;
}

export const SharedSection = ({
  title,
  emptyText,
  loading,
  items,
  resolveTitle,
  resolveColleagueName,
  resolveExpiry,
  renderAction,
}: SharedSectionProps) => {
  const t = useT();
  return (
    <section className={styles.sharedSection} aria-label={title}>
      <header className={styles.sharedSectionHeader}>
        <h3 className={styles.sharedSectionTitle}>{title}</h3>
        <span className={styles.sharedSectionCount}>{items.length}</span>
      </header>
      {loading ? (
        <div className={styles.sharedEmpty}>
          <Loader size={16} className={styles.spinningIcon} aria-hidden />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className={styles.sharedEmpty}>
          <FileText size={20} aria-hidden />
          <span>{emptyText}</span>
        </div>
      ) : (
        <ul className={styles.sharedList}>
          {items.map((item) => {
            const id = item.sharedMaterialId ?? item.id ?? '—';
            const { title: materialTitle } = resolveTitle(item);
            const uiStatus = resolveUiStatus(item);
            const expiry = resolveExpiry(item.sharedAt ?? item.createdAt);
            const statusLabel = t(`lecturer.materials.shared.status.${uiStatus}`, uiStatus);
            const openUrl = item.learningMaterialUrl || item.fileUrl || item.url;
            const canOpen = Boolean(openUrl && (uiStatus === 'ACCEPTED' || uiStatus === 'ACTIVE'));
            return (
              <li
                key={String(id)}
                className={`${styles.sharedRow} ${styles[`sharedRowStatus${uiStatus}`] ?? ''}`}
                data-testid="shared-material-row"
              >
                <div className={styles.sharedRowMain}>
                  <div className={styles.sharedRowTitleRow}>
                    <span
                      className={styles.sharedRowTitle}
                      style={canOpen ? { cursor: 'pointer', color: 'var(--ars-lecturer, #7c2d12)' } : undefined}
                      onClick={() => {
                        if (canOpen && openUrl) window.open(openUrl, '_blank', 'noopener,noreferrer');
                      }}
                      title={canOpen ? t('lecturer.materials.action.open', 'Open') : undefined}
                    >
                      {materialTitle}
                    </span>
                    <span className={`${styles.sharedStatusBadge} ${styles[`sharedStatus${uiStatus}`] ?? ''}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className={styles.sharedRowMeta}>
                    <span>
                      <span className={styles.sharedRowLabel}>{t('lecturer.materials.shared.colleague', 'Colleague')}:</span>{' '}
                      {resolveColleagueName(item)}
                    </span>
                    {expiry.iso && (
                      <span>
                        <span className={styles.sharedRowLabel}>{t('lecturer.materials.shared.expires', 'Expires')}:</span>{' '}
                        {expiry.daysRemaining !== null ? `${expiry.daysRemaining}d` : new Date(expiry.iso).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.sharedRowActions}>
                  {renderAction(item)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default SharedSection;

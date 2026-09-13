import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { Check, Medal, X } from 'lucide-react';
import type { UserMedal } from '../../services/medal.service';
import { SafeMedalBadge } from '../../features/admin/AdminMedals';
import { useI18n } from '../../i18n/I18nContext';
import styles from './TopMedalsModal.module.css';

interface TopMedalsModalProps {
  isOpen: boolean;
  medals: UserMedal[];
  selectedIds: string[];
  onClose: () => void;
  onSave: (selectedIds: string[]) => void;
}

export const TopMedalsModal = ({
  isOpen,
  medals,
  selectedIds,
  onClose,
  onSave,
}: TopMedalsModalProps) => {
  const { t } = useI18n();
  const unlocked = useMemo(
    () => medals.filter((item) => item?.isUnlocked && item.medal),
    [medals],
  );
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds.slice(0, 3));

  useEffect(() => {
    if (isOpen) setDraftIds(selectedIds.slice(0, 3));
  }, [isOpen, selectedIds]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleMedal = (medalId: string) => {
    setDraftIds((current) => {
      if (current.includes(medalId)) return current.filter((id) => id !== medalId);
      if (current.length >= 3) return current;
      return [...current, medalId];
    });
  };

  const selectedMedals = draftIds
    .map((id) => unlocked.find((item) => item.medal.id === id))
    .filter((item): item is UserMedal => Boolean(item));

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="top-medals-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{t('badges.topMedals.eyebrow', 'PROFILE DISPLAY')}</p>
            <h2 id="top-medals-title" className={styles.title}>
              {t('badges.topMedals.title', 'Choose your top 3 medals')}
            </h2>
            <p className={styles.subtitle}>
              {t('badges.topMedals.subtitle', 'These medals appear beside your name on your public profile.')}
            </p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('common.close', 'Close')}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.selectionSummary} aria-live="polite">
          <span>{t('badges.topMedals.selectedCount', '{count} of 3 selected').replace('{count}', String(draftIds.length))}</span>
          <div className={styles.selectedList}>
            {selectedMedals.map((item, index) => (
              <span key={item.medal.id} className={styles.selectedItem}>
                <span className={styles.position}>{index + 1}</span>
                {item.medal.title}
              </span>
            ))}
          </div>
        </div>

        {unlocked.length > 0 ? (
          <div className={styles.grid}>
            {unlocked.map((item) => {
              const medalId = item.medal.id;
              const position = draftIds.indexOf(medalId);
              const isSelected = position >= 0;
              return (
                <button
                  key={medalId}
                  type="button"
                  className={`${styles.tile} ${isSelected ? styles.tileSelected : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => toggleMedal(medalId)}
                >
                  <span className={styles.badge}>
                    <SafeMedalBadge
                      imageUrl={item.medal.imageUrl}
                      code={item.medal.code}
                      criteriaMetric={item.medal.criteriaMetric}
                      tier={item.medal.tier}
                      size={56}
                      alt={item.medal.title}
                    />
                  </span>
                  <span className={styles.medalName}>{item.medal.title}</span>
                  <span className={styles.medalTier}>{item.medal.tier}</span>
                  {isSelected ? (
                    <span className={styles.check} aria-label={t('badges.topMedals.position', 'Position {position}').replace('{position}', String(position + 1))}>
                      {position + 1}
                      <Check size={12} aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <Medal size={30} aria-hidden="true" />
            <p>{t('badges.topMedals.empty', 'Unlock medals to customize this part of your profile.')}</p>
          </div>
        )}

        <footer className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="button" className={styles.saveButton} onClick={() => { onSave(draftIds); onClose(); }}>
            {t('badges.topMedals.save', 'Save medal layout')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default TopMedalsModal;

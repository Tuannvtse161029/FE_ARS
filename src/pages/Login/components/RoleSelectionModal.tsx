import { useState, useEffect } from 'react';
import { Check, X, Shield } from 'lucide-react';
import type { UserRole } from '../../../types/auth';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './RoleSelectionModal.module.css';

interface RoleSelectionModalProps {
  open: boolean;
  username?: string;
  roles: UserRole[];
  onConfirm: (role: UserRole) => void;
  onCancel: () => void;
}

// Display labels for the role picker — kept in one place so the BE/API contract
// strings remain the canonical form on the wire.
const ROLE_LABELS: Record<UserRole, string> = {
  Researcher: 'Researcher',
  Reviewer: 'Reviewer',
  Lecturer: 'Lecturer (Seminar / Research Groups)',
  'Graduate Student': 'Graduate Student',
  Admin: 'Administrator',
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  Researcher: 'Submit manuscripts, manage peer reviews, and deposit locked funds.',
  Reviewer: 'Review submitted papers, score evaluation scorecards, and earn held funds payouts.',
  Lecturer: 'Manage research groups, schedule seminars, and AI-summarize recordings.',
  'Graduate Student': 'Join research cohorts, complete assigned topics, and submit PDF assignments.',
  Admin: 'System administrator (assigned only via the database).',
};

/**
 * Modal shown immediately after a multi-role user logs in. The user picks
 * one of the roles assigned to their account; the chosen role becomes the
 * active role for the session and is persisted into the auth store.
 */
const RoleSelectionModal = ({
  open,
  username,
  roles,
  onConfirm,
  onCancel,
}: RoleSelectionModalProps) => {
  const { t } = useI18n();
  const [selected, setSelected] = useState<UserRole | null>(roles[0] ?? null);

  // Reset the highlighted role whenever a new BE response arrives.
  useEffect(() => {
    setSelected(roles[0] ?? null);
  }, [roles]);

  if (!open) return null;

  const handleConfirm = () => {
    if (selected) onConfirm(selected);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-selection-title"
      onClick={onCancel}
    >
      <div className={styles.content} onClick={stop}>
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <span className={styles.headerIcon} aria-hidden="true">
              <Shield size={20} />
            </span>
            <h2 id="role-selection-title" className={styles.title}>
              {t('login.roleSelection.title')}
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onCancel}
            aria-label={t('common.cancel')}
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.description}>
            {username ? <>{t('login.roleSelection.welcome')} <b>{username}</b>. </> : null}
            {t('login.roleSelection.description')}
          </p>

          <div className={styles.roleList} role="radiogroup" aria-label="Assigned roles">
            {roles.map((role) => {
              const isSelected = selected === role;
              return (
                <label
                  key={role}
                  className={`${styles.roleOption} ${isSelected ? styles.roleOptionSelected : ''}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={isSelected}
                    onChange={() => setSelected(role)}
                    className={styles.roleOptionRadio}
                  />
                  <span className={styles.roleOptionLabel}>{t(`role.${role}`, ROLE_LABELS[role])}</span>
                  <span className={styles.roleOptionDesc}>{ROLE_DESCRIPTIONS[role]}</span>
                  {isSelected && (
                    <span className={styles.roleOptionCheck} aria-hidden="true">
                      <Check size={16} strokeWidth={3} />
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!selected}
          >
            {t('login.roleSelection.continueAs')} {selected ? t(`role.${selected}`) : '...'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionModal;

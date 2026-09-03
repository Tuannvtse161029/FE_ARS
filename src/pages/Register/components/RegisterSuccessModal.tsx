import { useEffect } from 'react';
import { Button } from '../../../components/Button';
import type { UserRole } from '../../../types/auth';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './RegisterSuccessModal.module.css';
import { Check } from '../../../assets/icons/CheckIcon';
import { ROUTES } from '../../../routes/paths';

interface RegisterSuccessModalProps {
  isOpen: boolean;
  email: string;
  role: UserRole;
  onClose: () => void;
}

export const RegisterSuccessModal = ({
  isOpen,
  email,
  role: _role,
  onClose,
}: RegisterSuccessModalProps) => {
  const { t } = useI18n();
  
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExploreForum = () => {
    onClose();
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-success-title"
    >
      <div className={styles.modal}>
        <div className={styles.checkmarkWrapper}>
          <Check className={styles.checkmarkIcon} size={24} />
        </div>
        <h2 id="register-success-title" className={styles.title}>
          {t('register.success.title', 'Registration Submitted Successfully!')}
        </h2>
        <p className={styles.message}>
          {t('register.success.roleReview', 'Your account has been created and your role request is now under Administrator review.')}
        </p>
        <div className={styles.highlightBox}>
          {t('register.success.verificationSent', 'We have sent a verification email to')} <strong>{email}</strong>
        </div>
        <p className={styles.helperText}>
          {t('register.success.helper', 'Open the link in that email to confirm your address. After verification an administrator will review your role request.')}
        </p>
        <p className={styles.learnMore}>
          {t('register.success.alreadyVerified', 'Already verified?')} {' '}
          <a
            href={ROUTES.LOGIN}
            className={styles.learnMoreLink}
            onClick={(e) => e.stopPropagation()}
          >
            {t('register.success.signInInstead', 'Sign in instead')}
          </a>
          .
        </p>
        <Button
          variant="primary"
          size="lg"
          onClick={handleExploreForum}
          className={styles.actionBtn}
        >
          {t('register.success.explore', 'Explore Community Forums')}
        </Button>
      </div>
    </div>
  );
};

export default RegisterSuccessModal;

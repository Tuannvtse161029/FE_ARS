import { useEffect } from 'react';
import { Button } from '../../../components/Button';
import type { UserRole } from '../../../types/auth';
import styles from './RegisterSuccessModal.module.css';
import { Check } from '../../../assets/icons/CheckIcon';

interface RegisterSuccessModalProps {
  isOpen: boolean;
  email: string;
  role: UserRole;
  onClose: () => void;
}

export const RegisterSuccessModal = ({
  isOpen,
  email,
  role,
  onClose,
}: RegisterSuccessModalProps) => {
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
    // The actual navigation is now handled by the parent (Register.tsx)
    // via the `onClose` callback, which knows about the auth-state changes
    // that just happened (the user is now authenticated but pending).
    // Keep the button here for UX clarity — it just closes the modal.
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
          Registration Submitted Successfully!
        </h2>
        <p className={styles.message}>
          Your account has been created and your role request for{' '}
          <strong>{role}</strong> is now under Administrator review.
        </p>
        <div className={styles.highlightBox}>
          We have sent a verification email to <strong>{email}</strong>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={handleExploreForum}
          className={styles.actionBtn}
        >
          Explore Community Forums
        </Button>
      </div>
    </div>
  );
};

export default RegisterSuccessModal;

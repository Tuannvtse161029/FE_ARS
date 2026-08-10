import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { ROUTES } from '../../../utils/constants';
import type { UserRole } from '../../../types/auth';
import styles from './RegisterSuccessModal.module.css';

interface RegisterSuccessModalProps {
  isOpen: boolean;
  email: string;
  role: UserRole;
  onClose: () => void;
}

const CheckIcon = () => (
  <svg
    className={styles.checkmarkIcon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const RegisterSuccessModal = ({
  isOpen,
  email,
  role,
  onClose,
}: RegisterSuccessModalProps) => {
  const navigate = useNavigate();

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
    navigate(ROUTES.FORUM);
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
          <CheckIcon />
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

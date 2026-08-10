import styles from './PasswordStrengthBar.module.css';

interface PasswordStrengthBarProps {
  password: string;
}

type Strength = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

const computeStrength = (password: string): { score: number; label: string; variant: Strength } => {
  if (!password) return { score: 0, label: '', variant: 'empty' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 1, label: 'Weak', variant: 'weak' };
  if (score === 3) return { score: 2, label: 'Fair', variant: 'fair' };
  if (score === 4) return { score: 3, label: 'Good', variant: 'good' };
  return { score: 4, label: 'Strong', variant: 'strong' };
};

export const PasswordStrengthBar = ({ password }: PasswordStrengthBarProps) => {
  const { score, label, variant } = computeStrength(password);

  if (variant === 'empty') return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.barTrack}>
        <div className={`${styles.barFill} ${styles[`barFill_${variant}`]}`} style={{ width: `${score * 25}%` }} />
      </div>
      <span className={`${styles.label} ${styles[`label_${variant}`]}`}>{label}</span>
    </div>
  );
};

export default PasswordStrengthBar;
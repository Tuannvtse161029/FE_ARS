import { getReviewRequestStatusDisplay } from '../../utils/reviewRequestDisplay';
import styles from './ReviewRequestStatusBadge.module.css';

interface ReviewRequestStatusBadgeProps {
  status: string | null | undefined;
  // Optional size override — defaults to 'sm'.
  size?: 'sm' | 'md';
}

/**
 * Single source of truth for the Review Request status pill.
 *
 * Layout is `inline-flex` / `align-items: center` / consistent `gap` so the
 * icon and label render on a single line with no disconnected dot. Completed
 * uses a green semantic treatment (green text + light green background +
 * CheckCircle2 icon).
 */
export const ReviewRequestStatusBadge = ({
  status,
  size = 'sm',
}: ReviewRequestStatusBadgeProps) => {
  const display = getReviewRequestStatusDisplay(status);
  const Icon = display.icon;
  const sizeClass = size === 'md' ? styles.sizeMd : styles.sizeSm;
  return (
    <span
      className={`${styles.badge} ${styles[display.cssClass]} ${sizeClass}`}
      data-testid="review-request-status-badge"
      data-status={display.label}
    >
      <Icon size={size === 'md' ? 14 : 12} aria-hidden="true" className={styles.icon} />
      <span className={styles.label}>{display.label}</span>
    </span>
  );
};

export default ReviewRequestStatusBadge;
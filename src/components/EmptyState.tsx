/**
 * EmptyState — honest empty-list placeholder.
 *
 * Use when a table or list has zero rows. Pair with `SkeletonRow` while the
 * request is in flight and `ErrorBanner` on failure. Never fabricate
 * placeholder data inside this component.
 */
import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** Lucide icon, 24px recommended */
  icon: ReactNode;
  /** Short title (Inter 14/600) */
  title: string;
  /** One-line description in muted ink (Inter 13/400) */
  description?: string;
  /** Optional primary action (button node) */
  action?: ReactNode;
  /** Optional tighter version for inside-table use */
  compact?: boolean;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  compact,
}: EmptyStateProps) => (
  <div
    className={`${styles.empty} ${compact ? styles.compact : ''}`}
    role="status"
    data-component="EmptyState"
  >
    <div className={styles.iconWrap} aria-hidden>
      {icon}
    </div>
    <p className={styles.title}>{title}</p>
    {description && <p className={styles.description}>{description}</p>}
    {action && <div className={styles.action}>{action}</div>}
  </div>
);

export default EmptyState;

/**
 * MetricCard — Editorial stat card for workspace dashboards.
 * Shows a label, a large value, and an optional annotation.
 * No heavy gradients, no shadow-lifts — just clean typography.
 */
import type { ReactNode } from 'react';
import styles from './MetricCard.module.css';

export interface MetricCardProps {
  /** Section label, e.g. "Papers Submitted" */
  label: string;
  /** Large primary value */
  value: string | number;
  /** Optional secondary text */
  annotation?: string;
  /** Optional icon node (left accent) */
  icon?: ReactNode;
  /** Role accent color */
  accent?: string;
  className?: string;
}

export const MetricCard = ({
  label,
  value,
  annotation,
  icon,
  accent,
  className,
}: MetricCardProps) => {
  return (
    <article
      className={`${styles.card} ${className ?? ''}`}
      style={accent ? ({ '--card-accent': accent } as React.CSSProperties) : undefined}
    >
      <div className={styles.inner}>
        {icon && (
          <div className={styles.iconWrap} aria-hidden="true">
            {icon}
          </div>
        )}
        <div className={styles.content}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{value}</span>
          {annotation && (
            <span className={styles.annotation}>{annotation}</span>
          )}
        </div>
      </div>
      <div className={styles.accentLine} aria-hidden="true" />
    </article>
  );
};

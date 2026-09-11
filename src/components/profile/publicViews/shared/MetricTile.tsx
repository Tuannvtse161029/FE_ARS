/**
 * MetricTile — large editorial number tile used across every role view.
 * Reads role accent via `--profile-accent` (set by parent). Numeral uses
 * serif to give each role's metric bank a coordinated editorial feel.
 */
import type { ReactNode } from 'react';
import styles from './MetricTile.module.css';

export interface MetricTileProps {
  /** Mono uppercase eyebrow above the number, e.g. "H-INDEX". */
  label: string;
  /** The big numeric or text value. Accepts strings so role views can show
   *  values like "—" or "n/a" honestly when the BE has not surfaced a number. */
  value: ReactNode;
  /** Optional small caption under the number. */
  caption?: string;
  /** Optional tone for the numeral — defaults to "default". */
  tone?: 'default' | 'muted' | 'positive' | 'attention';
  /** Optional trailing icon. */
  icon?: ReactNode;
  'data-testid'?: string;
}

export const MetricTile = ({
  label,
  value,
  caption,
  tone = 'default',
  icon,
  'data-testid': testId,
}: MetricTileProps) => {
  const toneClass =
    tone === 'muted'
      ? styles.toneMuted
      : tone === 'positive'
        ? styles.tonePositive
        : tone === 'attention'
          ? styles.toneAttention
          : styles.toneDefault;

  return (
    <article
      className={`${styles.tile} ${toneClass}`}
      data-testid={testId}
    >
      <p className={styles.label}>{label}</p>
      <div className={styles.valueRow}>
        <strong className={styles.value}>{value}</strong>
        {icon ? (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </article>
  );
};

export default MetricTile;

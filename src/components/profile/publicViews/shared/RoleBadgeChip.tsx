/**
 * RoleBadgeChip — uppercase mono chip used in identity strips to tag the
 * role that owns this profile surface. Reads role accent via
 * `--profile-accent`. Renders both an accent border and a left tinted
 * rule to feel at home next to any section shell.
 */
import styles from './RoleBadgeChip.module.css';

export interface RoleBadgeChipProps {
  label: string;
  /** Sub-line under the label (e.g. "Public profile"). */
  hint?: string;
  'data-testid'?: string;
}

export const RoleBadgeChip = ({ label, hint, 'data-testid': testId }: RoleBadgeChipProps) => {
  return (
    <span
      className={styles.chip}
      data-testid={testId}
      style={{ ['--chip-accent' as string]: 'var(--profile-accent, var(--accent-primary))' }}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>
    </span>
  );
};

export default RoleBadgeChip;

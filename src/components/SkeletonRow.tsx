/**
 * SkeletonRow — neutral placeholder rows for loading tables.
 *
 * Replaces per-page spinners and ad-hoc `<div className="shimmer" />`
 * snippets. Stacks N rows of identical height. Color uses the existing
 * `--ars-paper-alt` background so it blends with the new table surface.
 */
import styles from './SkeletonRow.module.css';

export interface SkeletonRowProps {
  /** Number of rows to render */
  count?: number;
  /** Row height in pixels (defaults to 36) */
  rowHeight?: number;
  /** Gap between rows in pixels (defaults to 8) */
  gap?: number;
  /** Show a header bar (defaults to false) */
  withHeader?: boolean;
}

export const SkeletonRow = ({
  count = 6,
  rowHeight = 36,
  gap = 8,
  withHeader = false,
}: SkeletonRowProps) => (
  <div
    className={styles.stack}
    style={{ gap }}
    role="status"
    aria-label="Loading"
    data-component="SkeletonRow"
  >
    {withHeader && (
      <div
        className={styles.headerBar}
        style={{ height: rowHeight + 4 }}
        aria-hidden
      />
    )}
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={styles.row}
        style={{ height: rowHeight }}
        aria-hidden
      />
    ))}
  </div>
);

export default SkeletonRow;

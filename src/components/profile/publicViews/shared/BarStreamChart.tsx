/**
 * BarStreamChart — horizontal bar list keyed by year (or any label).
 * Used by the Researcher and Reviewer public views for their year→count
 * publication/contribution stream. Bar fill uses `currentColor` so the
 * parent role view can recolor by wrapping it in a container that sets
 * the role accent.
 */
import { useId, useMemo } from 'react';
import styles from './BarStreamChart.module.css';

export interface BarStreamDatum {
  /** Label shown on the left rail (typically a year). */
  label: string;
  /** Numeric value. Treated as 0 if null/undefined/NaN. */
  value: number;
}

export interface BarStreamChartProps {
  data: BarStreamDatum[];
  /** When true, render empty state ("No data yet"). */
  empty?: boolean;
  emptyLabel?: string;
  /** Caption shown under the chart. */
  caption?: string;
  'data-testid'?: string;
}

export const BarStreamChart = ({
  data,
  empty,
  emptyLabel,
  caption,
  'data-testid': testId,
}: BarStreamChartProps) => {
  const fallbackId = useId();
  const max = useMemo(() => {
    if (!data.length) return 0;
    return data.reduce((acc, d) => (Number.isFinite(d.value) ? Math.max(acc, d.value) : acc), 0);
  }, [data]);

  if (empty || data.length === 0) {
    return (
      <div className={styles.empty} data-testid={testId}>
        <p className={styles.emptyLabel}>{emptyLabel ?? '—'}</p>
        {caption ? <p className={styles.emptyCaption}>{caption}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.chart} data-testid={testId}>
      <ul className={styles.rows}>
        {data.map((d) => {
          const safeValue = Number.isFinite(d.value) ? d.value : 0;
          const widthPct = max > 0 ? Math.max(2, Math.round((safeValue / max) * 100)) : 0;
          const rowId = `${fallbackId}-${d.label}`;
          return (
            <li key={d.label} className={styles.row}>
              <span className={styles.label} id={rowId}>
                {d.label}
              </span>
              <div className={styles.barTrack} aria-hidden="true">
                <span
                  className={styles.barFill}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className={styles.value} aria-labelledby={rowId}>
                {safeValue}
              </span>
            </li>
          );
        })}
      </ul>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </div>
  );
};

export default BarStreamChart;

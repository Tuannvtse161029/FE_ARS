/**
 * ActivityFeed — Vertical timeline for recent activity entries.
 * Inspired by academic event logs and citation timelines.
 */
import type { ReactNode } from 'react';
import styles from './ActivityFeed.module.css';

export interface ActivityEntry {
  id: string;
  /** Primary text */
  title: string;
  /** Secondary metadata text */
  meta?: string;
  /** Timestamp label */
  time?: string;
  /** Optional status badge/category */
  tag?: ReactNode;
  /** Click handler */
  onClick?: () => void;
}

export interface ActivityFeedProps {
  entries: ActivityEntry[];
  /** "01 / RECENT ACTIVITY" marker text */
  marker?: string;
  title?: string;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
}

export const ActivityFeed = ({
  entries,
  marker = '01 / RECENT ACTIVITY',
  title = 'Recent Activity',
  emptyMessage = 'No activity recorded yet.',
  loading = false,
  className,
}: ActivityFeedProps) => {
  return (
    <section className={`${styles.feed} ${className ?? ''}`} aria-label={title}>
      <div className={styles.sectionHeader}>
        <span className={styles.marker}>{marker}</span>
        <h2 className={styles.title}>{title}</h2>
      </div>

      {loading ? (
        <div className={styles.loadingState} role="status">
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyText}>{emptyMessage}</span>
        </div>
      ) : (
        <ol className={styles.list}>
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className={`${styles.item} ${entry.onClick ? styles.itemClickable : ''}`}
              onClick={entry.onClick}
              role={entry.onClick ? 'button' : undefined}
              tabIndex={entry.onClick ? 0 : undefined}
              onKeyDown={
                entry.onClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        entry.onClick?.();
                      }
                    }
                  : undefined
              }
            >
              {/* Timeline node */}
              <div className={styles.node} aria-hidden="true">
                <span className={styles.nodeDot} />
                {index < entries.length - 1 && <span className={styles.nodeLine} />}
              </div>

              {/* Content */}
              <div className={styles.content}>
                <div className={styles.row}>
                  <span className={styles.itemTitle}>{entry.title}</span>
                  {entry.tag && (
                    <span className={styles.tag}>{entry.tag}</span>
                  )}
                </div>
                <div className={styles.meta}>
                  {entry.meta && (
                    <span className={styles.metaText}>{entry.meta}</span>
                  )}
                  {entry.time && (
                    <span className={styles.time}>{entry.time}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

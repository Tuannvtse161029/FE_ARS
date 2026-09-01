/**
 * InlineNotice — compact contextual notice used in place of full-width
 * warning banners. Renders a small icon, a short title, and an optional
 * one-line description. Two visual variants:
 *
 * - "info" (default)    — neutral / awaiting-support contexts
 * - "warning"           — only when the lecturer's primary action is blocked
 *
 * Does not use a colored border-left stripe (impeccable craft-floor bans
 * them on cards/list items/callouts/alerts). Uses a soft tinted surface
 * + icon + text. Hover/focus/disabled states are not relevant for this
 * passive component.
 */
import { Info, AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './InlineNotice.module.css';

export type InlineNoticeTone = 'info' | 'warning';

export interface InlineNoticeProps {
  tone?: InlineNoticeTone;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}

export const InlineNotice = ({
  tone = 'info',
  title,
  description,
  className,
}: InlineNoticeProps) => {
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <div
      role="status"
      className={`${styles.notice} ${styles[tone]} ${className ?? ''}`.trim()}
    >
      <span className={styles.icon} aria-hidden>
        <Icon size={14} />
      </span>
      <div className={styles.body}>
        <span className={styles.title}>{title}</span>
        {description ? (
          <span className={styles.description}>{description}</span>
        ) : null}
      </div>
    </div>
  );
};

export default InlineNotice;
